import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { config } from '../config';
import { signToken, requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { notify } from './notifications';

export const authRouter = Router();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const phoneSchema = z.object({ phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits') });

/** Step 1: request OTP. In dev the OTP is static; in prod it goes out via SMS. */
authRouter.post('/otp/request', h(async (req, res) => {
  const { phone } = phoneSchema.parse(req.body);
  const code = config.isDev ? config.devStaticOtp : String(Math.floor(100000 + Math.random() * 900000));
  await db.otpCode.upsert({
    where: { phone },
    create: { phone, code, expiresAt: new Date(Date.now() + 5 * 60_000) },
    update: { code, attempts: 0, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
  await notify(null, 'sms', 'Pronto OTP', `Your OTP is ${code}`, phone);
  res.json({ ok: true });
}));

/** Step 2: verify OTP → JWT. Creates the user on first login. `as` decides customer vs worker app. */
authRouter.post('/otp/verify', h(async (req, res) => {
  const { phone, code, as } = z.object({
    phone: z.string().regex(/^\d{10}$/),
    code: z.string(),
    as: z.enum(['CUSTOMER', 'WORKER']).default('CUSTOMER'),
  }).parse(req.body);

  const otp = await db.otpCode.findUnique({ where: { phone } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, 'OTP expired, request a new one');
  if (otp.attempts >= 5) throw new HttpError(429, 'Too many attempts');
  if (otp.code !== code) {
    await db.otpCode.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'Incorrect OTP');
  }
  await db.otpCode.delete({ where: { phone } });

  let user = await db.user.findUnique({ where: { phone }, include: { worker: true } });
  const isNew = !user;
  if (!user) {
    user = await db.user.create({ data: { phone, role: as }, include: { worker: true } });
    if (as === 'WORKER') {
      await db.worker.create({ data: { userId: user.id } });
      user = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { worker: true } });
    }
  }
  if (user.banned) throw new HttpError(403, 'Account is banned');
  // A worker phone logging into the worker app after being created as customer
  if (as === 'WORKER' && !user.worker) {
    await db.worker.create({ data: { userId: user.id } });
    user = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { worker: true } });
  }

  const token = signToken({
    sub: user.id,
    role: as,
    workerId: user.worker?.id,
  });
  res.json({
    token, isNew,
    user: { id: user.id, phone: user.phone, name: user.name, email: user.email, role: as },
    workerId: user.worker?.id ?? null,
  });
}));

/** Admin email+password login. */
authRouter.post('/admin/login', h(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.active || admin.passwordHash !== sha(password)) {
    throw new HttpError(401, 'Invalid credentials');
  }
  const token = signToken({ sub: admin.id, role: 'ADMIN', adminRole: admin.role, cityId: admin.cityId, hubId: admin.hubId });
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, cityId: admin.cityId, hubId: admin.hubId } });
}));

authRouter.get('/me', requireAuth(), h(async (req, res) => {
  if (req.auth!.role === 'ADMIN') {
    const admin = await db.adminUser.findUnique({ where: { id: req.auth!.sub } });
    return res.json({ admin });
  }
  const user = await db.user.findUnique({
    where: { id: req.auth!.sub },
    include: { worker: { include: { hub: true } } },
  });
  res.json({ user });
}));
