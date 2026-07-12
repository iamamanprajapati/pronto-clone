import { Router } from 'express';
import { z } from 'zod';
import { HUB_CHECKIN_GEOFENCE_M, WORKER_LIVENESS_TTL_S } from '@pronto/shared';
import { db } from '../db';
import { config } from '../config';
import { anchorKey, geoKey, redis, type DevAnchor } from '../redis';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { distanceM } from '../lib/geo';

/**
 * Worker-facing workforce module: registration/KYC, training, duty toggle,
 * shifts/attendance, leave, performance, announcements.
 * Admin-side review lives in admin.ts.
 */

export const workforceRouter = Router();
workforceRouter.use(requireAuth('WORKER'));

async function me(req: { auth?: { workerId?: string } }) {
  const worker = await db.worker.findUnique({
    where: { id: req.auth!.workerId! },
    include: { user: true, hub: true },
  });
  if (!worker) throw new HttpError(404, 'Worker profile not found');
  return worker;
}

workforceRouter.get('/me', h(async (req, res) => {
  const w = await me(req);
  const kyc = await db.kycDoc.findMany({ where: { workerId: w.id } });
  res.json({
    worker: {
      id: w.id, name: w.user.name, phone: w.user.phone, status: w.status, duty: w.duty,
      rating: w.rating, jobsDone: w.jobsDone, skills: w.skills, languages: w.languages,
      hub: w.hub ? { id: w.hub.id, name: w.hub.name, lat: w.hub.lat, lng: w.hub.lng } : null,
      kycStatus: kyc.length === 0 ? 'PENDING' : kyc.every(d => d.status === 'APPROVED') ? 'APPROVED'
        : kyc.some(d => d.status === 'REJECTED') ? 'REJECTED' : 'SUBMITTED',
      strikes: w.strikes, bankAccount: w.bankAccount, upiId: w.upiId,
    },
  });
}));

// ── Registration wizard ──
workforceRouter.post('/register', h(async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    skills: z.array(z.string()).min(1),
    languages: z.array(z.string()).min(1),
    aadhaarLast4: z.string().length(4),
    panMasked: z.string().min(4),
    bankAccount: z.string().optional(),
    bankIfsc: z.string().optional(),
    upiId: z.string().optional(),
  }).parse(req.body);
  const w = await me(req);
  if (w.status !== 'NEW') throw new HttpError(409, 'Already registered');

  await db.user.update({ where: { id: w.userId }, data: { name: body.name } });
  await db.kycDoc.createMany({
    data: [
      { workerId: w.id, docType: 'AADHAAR', docRef: `xxxx-${body.aadhaarLast4}` },
      { workerId: w.id, docType: 'PAN', docRef: body.panMasked },
      { workerId: w.id, docType: 'SELFIE', docRef: 'selfie-upload-key' },
    ],
  });
  const worker = await db.worker.update({
    where: { id: w.id },
    data: {
      status: 'UNDER_REVIEW', skills: body.skills, languages: body.languages,
      bankAccount: body.bankAccount, bankIfsc: body.bankIfsc, upiId: body.upiId,
    },
  });
  res.json({ worker });
}));

workforceRouter.patch('/bank', h(async (req, res) => {
  const body = z.object({
    bankAccount: z.string().optional(), bankIfsc: z.string().optional(), upiId: z.string().optional(),
  }).parse(req.body);
  const w = await me(req);
  const worker = await db.worker.update({ where: { id: w.id }, data: body });
  res.json({ worker });
}));

// ── Training ──
workforceRouter.get('/training', h(async (req, res) => {
  const w = await me(req);
  const modules = await db.trainingModule.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  const progress = await db.trainingProgress.findMany({ where: { workerId: w.id } });
  res.json({
    modules: modules.map(m => ({
      id: m.id, title: m.title, contentUrl: m.contentUrl,
      quiz: (m.quiz as Array<{ q: string; options: string[] }>).map(q => ({ q: q.q, options: q.options })),
      passed: progress.find(p => p.moduleId === m.id)?.passed ?? false,
    })),
  });
}));

workforceRouter.post('/training/:moduleId/submit', h(async (req, res) => {
  const { answers } = z.object({ answers: z.array(z.number()) }).parse(req.body);
  const w = await me(req);
  const mod = await db.trainingModule.findUnique({ where: { id: req.params.moduleId } });
  if (!mod) throw new HttpError(404, 'Module not found');
  const quiz = mod.quiz as Array<{ answerIdx: number }>;
  const correct = quiz.filter((q, i) => answers[i] === q.answerIdx).length;
  const scorePct = Math.round((correct / quiz.length) * 100);
  const passed = scorePct >= mod.passPct;

  await db.trainingProgress.upsert({
    where: { workerId_moduleId: { workerId: w.id, moduleId: mod.id } },
    create: { workerId: w.id, moduleId: mod.id, scorePct, passed },
    update: { scorePct, passed },
  });

  // all modules passed + status TRAINING → ACTIVE
  if (passed && w.status === 'TRAINING') {
    const allModules = await db.trainingModule.count({ where: { active: true } });
    const passedCount = await db.trainingProgress.count({ where: { workerId: w.id, passed: true } });
    if (passedCount >= allModules) {
      await db.worker.update({ where: { id: w.id }, data: { status: 'ACTIVE' } });
    }
  }
  res.json({ scorePct, passed });
}));

// ── Duty toggle (geofenced to hub) ──
workforceRouter.post('/duty', h(async (req, res) => {
  const { on, lat, lng } = z.object({ on: z.boolean(), lat: z.number(), lng: z.number() }).parse(req.body);
  const w = await me(req);
  if (w.status !== 'ACTIVE') throw new HttpError(403, 'Account is not active');

  if (on) {
    // geofence enforced in production only — dev machines are rarely near the seeded hub
    if (!config.isDev && w.hub && distanceM(lat, lng, w.hub.lat, w.hub.lng) > HUB_CHECKIN_GEOFENCE_M) {
      throw new HttpError(400, `Check in within ${HUB_CHECKIN_GEOFENCE_M}m of ${w.hub.name}`);
    }
    const shift = await db.shift.findFirst({
      where: { workerId: w.id, startAt: { lte: new Date() }, endAt: { gte: new Date() } },
    });
    await db.attendance.create({
      data: { workerId: w.id, shiftId: shift?.id, checkinLat: lat, checkinLng: lng },
    });
    await db.worker.update({ where: { id: w.id }, data: { duty: 'IDLE' } });
    // Dev: register in the active tester's zone (global anchor) so the worker is
    // instantly visible/dispatchable next to the customer; prod uses the hub zone.
    let dutyZoneId = w.hub?.zoneId ?? null;
    let dutyLat = lat, dutyLng = lng;
    if (config.isDev) {
      const rawAnchor = await redis.get(anchorKey());
      if (rawAnchor) {
        const a = JSON.parse(rawAnchor) as DevAnchor;
        dutyZoneId = a.zoneId;
        const distM = Math.hypot(a.lat - lat, a.lng - lng) * 111_000;
        if (distM > 2000) { dutyLat = a.lat + 0.001; dutyLng = a.lng + 0.001; }
      }
    }
    if (dutyZoneId) await redis.geoadd(geoKey(dutyZoneId), dutyLng, dutyLat, `worker:${w.id}`);
    await redis.hset(`worker:${w.id}:live`, { lat: dutyLat, lng: dutyLng, duty: 'IDLE', idleSince: Date.now(), zoneId: dutyZoneId ?? '' });
    await redis.expire(`worker:${w.id}:live`, WORKER_LIVENESS_TTL_S);
  } else {
    if (w.duty === 'ON_JOB' || w.duty === 'EN_ROUTE') throw new HttpError(409, 'Finish your active job first');
    const open = await db.attendance.findFirst({
      where: { workerId: w.id, checkoutAt: null }, orderBy: { checkinAt: 'desc' },
    });
    if (open) await db.attendance.update({ where: { id: open.id }, data: { checkoutAt: new Date() } });
    await db.worker.update({ where: { id: w.id }, data: { duty: 'OFF_DUTY' } });
    if (w.hub?.zoneId) await redis.zrem(geoKey(w.hub.zoneId), `worker:${w.id}`);
    await redis.del(`worker:${w.id}:live`);
  }
  res.json({ ok: true, duty: on ? 'IDLE' : 'OFF_DUTY' });
}));

// ── Jobs (today / active) ──
workforceRouter.get('/jobs', h(async (req, res) => {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const jobs = await db.booking.findMany({
    where: {
      workerId: req.auth!.workerId!,
      OR: [
        { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } },
        { completedAt: { gte: startOfDay } },
        { scheduledAt: { gte: startOfDay } },
      ],
    },
    include: { address: true, customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const services = await db.service.findMany();
  const nameOf = (slug: string) => services.find(s => s.slug === slug)?.name ?? slug;
  res.json({
    jobs: jobs.map(j => ({
      id: j.id, status: j.status, tasks: j.tasks.map(nameOf), durationMin: j.durationMin,
      scheduledAt: j.scheduledAt, timerEndsAt: j.timerEndsAt,
      address: { lat: j.address.lat, lng: j.address.lng, flat: j.address.flat, landmark: j.address.landmark },
      customerName: (j.customer.name ?? 'Customer').split(' ')[0],
      instructions: j.instructions,
    })),
  });
}));

// ── Roster / attendance / leave ──
workforceRouter.get('/shifts', h(async (req, res) => {
  const shifts = await db.shift.findMany({
    where: { workerId: req.auth!.workerId!, endAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    include: { hub: { select: { name: true } } },
    orderBy: { startAt: 'asc' },
  });
  res.json({ shifts });
}));

workforceRouter.get('/attendance', h(async (req, res) => {
  const attendance = await db.attendance.findMany({
    where: { workerId: req.auth!.workerId! }, orderBy: { checkinAt: 'desc' }, take: 30,
  });
  res.json({ attendance });
}));

workforceRouter.post('/leave', h(async (req, res) => {
  const body = z.object({
    fromDate: z.string().datetime(), toDate: z.string().datetime(), reason: z.string().min(3),
  }).parse(req.body);
  const leave = await db.leave.create({
    data: {
      workerId: req.auth!.workerId!,
      fromDate: new Date(body.fromDate), toDate: new Date(body.toDate), reason: body.reason,
    },
  });
  res.json({ leave });
}));

workforceRouter.get('/leave', h(async (req, res) => {
  const leaves = await db.leave.findMany({ where: { workerId: req.auth!.workerId! }, orderBy: { fromDate: 'desc' } });
  res.json({ leaves });
}));

// ── Performance ──
workforceRouter.get('/performance', h(async (req, res) => {
  const workerId = req.auth!.workerId!;
  const w = await db.worker.findUniqueOrThrow({ where: { id: workerId } });
  const offers = await db.offer.groupBy({ by: ['response'], where: { workerId }, _count: true });
  const total = offers.reduce((s, o) => s + o._count, 0);
  const accepted = offers.find(o => o.response === 'ACCEPTED')?._count ?? 0;
  const ratings = await db.rating.findMany({
    where: { direction: 'customer_to_worker', booking: { workerId } },
    orderBy: { createdAt: 'desc' }, take: 10,
    select: { stars: true, tags: true, comment: true, createdAt: true },
  });
  res.json({
    rating: w.rating, ratingCount: w.ratingCount, jobsDone: w.jobsDone, strikes: w.strikes,
    acceptanceRate: total ? Math.round((accepted / total) * 100) : 100,
    recentRatings: ratings,
  });
}));

// ── Announcements ──
workforceRouter.get('/announcements', h(async (_req, res) => {
  const announcements = await db.announcement.findMany({
    where: { audience: 'workers', active: true }, orderBy: { at: 'desc' }, take: 20,
  });
  res.json({ announcements });
}));
