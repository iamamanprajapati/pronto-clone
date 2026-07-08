import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';

export const usersRouter = Router();
usersRouter.use(requireAuth('CUSTOMER', 'WORKER'));

usersRouter.patch('/profile', h(async (req, res) => {
  const { name, email, referralCode } = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal('')),
    referralCode: z.string().optional(),
  }).parse(req.body);

  let referredBy: string | undefined;
  if (referralCode) {
    const referrer = await db.user.findUnique({ where: { referralCode } });
    if (referrer && referrer.id !== req.auth!.sub) referredBy = referrer.id;
  }
  const user = await db.user.update({
    where: { id: req.auth!.sub },
    data: { name, email: email || undefined, ...(referredBy ? { referredBy } : {}) },
  });
  res.json({ user });
}));

// ── Addresses ──
usersRouter.get('/addresses', h(async (req, res) => {
  const addresses = await db.address.findMany({ where: { userId: req.auth!.sub, deleted: false } });
  res.json({ addresses });
}));

const addressSchema = z.object({
  tag: z.string().default('Home'),
  lat: z.number(), lng: z.number(),
  flat: z.string().min(1), landmark: z.string().optional(),
});

usersRouter.post('/addresses', h(async (req, res) => {
  const data = addressSchema.parse(req.body);
  const address = await db.address.create({ data: { ...data, userId: req.auth!.sub } });
  res.json({ address });
}));

usersRouter.patch('/addresses/:id', h(async (req, res) => {
  const data = addressSchema.partial().parse(req.body);
  const existing = await db.address.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!existing) throw new HttpError(404, 'Address not found');
  const address = await db.address.update({ where: { id: existing.id }, data });
  res.json({ address });
}));

usersRouter.delete('/addresses/:id', h(async (req, res) => {
  const existing = await db.address.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!existing) throw new HttpError(404, 'Address not found');
  await db.address.update({ where: { id: existing.id }, data: { deleted: true } });
  res.json({ ok: true });
}));

// ── Favourites / blocked experts ──
usersRouter.get('/favourites', h(async (req, res) => {
  const favs = await db.favouriteWorker.findMany({
    where: { userId: req.auth!.sub },
    include: { worker: { include: { user: true } } },
  });
  res.json({ favourites: favs.map(f => ({ id: f.workerId, name: f.worker.user.name, rating: f.worker.rating, jobsDone: f.worker.jobsDone })) });
}));

usersRouter.post('/favourites/:workerId', h(async (req, res) => {
  await db.favouriteWorker.upsert({
    where: { userId_workerId: { userId: req.auth!.sub, workerId: req.params.workerId } },
    create: { userId: req.auth!.sub, workerId: req.params.workerId },
    update: {},
  });
  res.json({ ok: true });
}));

usersRouter.delete('/favourites/:workerId', h(async (req, res) => {
  await db.favouriteWorker.deleteMany({ where: { userId: req.auth!.sub, workerId: req.params.workerId } });
  res.json({ ok: true });
}));

usersRouter.post('/blocked/:workerId', h(async (req, res) => {
  await db.blockedWorker.upsert({
    where: { userId_workerId: { userId: req.auth!.sub, workerId: req.params.workerId } },
    create: { userId: req.auth!.sub, workerId: req.params.workerId },
    update: {},
  });
  res.json({ ok: true });
}));

// ── Referral ──
usersRouter.get('/referral', h(async (req, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.auth!.sub } });
  const referred = await db.user.count({ where: { referredBy: user.id } });
  res.json({ code: user.referralCode, referredCount: referred, creditsPaise: user.creditsPaise });
}));

// ── Notifications inbox ──
usersRouter.get('/notifications', h(async (req, res) => {
  const notifications = await db.notification.findMany({
    where: { userId: req.auth!.sub }, orderBy: { at: 'desc' }, take: 50,
  });
  res.json({ notifications });
}));

usersRouter.post('/notifications/read', h(async (req, res) => {
  await db.notification.updateMany({ where: { userId: req.auth!.sub }, data: { read: true } });
  res.json({ ok: true });
}));
