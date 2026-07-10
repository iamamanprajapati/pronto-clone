import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { requireAdmin } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { transition } from './bookingService';
import { dispatchBooking, releaseWorker } from './dispatch';

export const adminRouter = Router();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Every admin mutation is audit-logged with actor + before/after. */
async function audit(adminId: string, action: string, entity: string, entityId?: string, before?: unknown, after?: unknown) {
  await db.auditLog.create({
    data: { adminId, action, entity, entityId, before: before as never, after: after as never },
  });
}

// ───────────────────────── Live ops ─────────────────────────

adminRouter.get('/ops/overview', requireAdmin(), h(async (_req, res) => {
  const [active, idle, sosOpen, unassigned] = await Promise.all([
    db.booking.count({ where: { status: { in: ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } } }),
    db.worker.count({ where: { duty: 'IDLE' } }),
    db.sosEvent.count({ where: { status: 'OPEN' } }),
    db.booking.count({ where: { status: 'NO_EXPERT_FOUND', createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
  ]);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayBookings = await db.booking.count({ where: { createdAt: { gte: startOfDay } } });
  const todayCompleted = await db.booking.count({ where: { completedAt: { gte: startOfDay } } });
  const gmv = await db.booking.aggregate({
    where: { completedAt: { gte: startOfDay } }, _sum: { totalPaise: true },
  });
  res.json({
    activeBookings: active, idleWorkers: idle, openSos: sosOpen, unassignedLastHour: unassigned,
    todayBookings, todayCompleted, todayGmvPaise: gmv._sum.totalPaise ?? 0,
  });
}));

adminRouter.get('/ops/active-bookings', requireAdmin(), h(async (_req, res) => {
  const bookings = await db.booking.findMany({
    where: { status: { in: ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'NO_EXPERT_FOUND'] } },
    include: {
      customer: { select: { name: true, phone: true } },
      worker: { include: { user: { select: { name: true, phone: true } } } },
      address: true, zone: { select: { name: true, cityId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ bookings });
}));

adminRouter.post('/ops/bookings/:id/reassign', requireAdmin('CITY_OPS'), h(async (req, res) => {
  const b = await db.booking.findUnique({ where: { id: req.params.id } });
  if (!b) throw new HttpError(404, 'Booking not found');
  if (!['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'NO_EXPERT_FOUND'].includes(b.status)) {
    throw new HttpError(409, 'Booking not in a reassignable state');
  }
  if (b.workerId) await releaseWorker(b.workerId);
  await db.booking.update({ where: { id: b.id }, data: { workerId: null, offerRound: 0 } });
  await transition(b.id, 'SEARCHING', { kind: 'admin', id: req.auth!.sub }, { reason: 'manual reassign' });
  await dispatchBooking(b.id);
  await audit(req.auth!.sub, 'reassign', 'booking', b.id);
  res.json({ ok: true });
}));

adminRouter.post('/ops/bookings/:id/cancel', requireAdmin('CITY_OPS'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().min(3) }).parse(req.body);
  const b = await db.booking.findUnique({ where: { id: req.params.id } });
  if (!b) throw new HttpError(404, 'Booking not found');
  if (b.workerId) await releaseWorker(b.workerId);
  await transition(b.id, 'CANCELLED_ADMIN', { kind: 'admin', id: req.auth!.sub }, { reason });
  await audit(req.auth!.sub, 'cancel', 'booking', b.id, { status: b.status }, { reason });
  res.json({ ok: true });
}));

// ───────────────────────── Bookings table ─────────────────────────

adminRouter.get('/bookings', requireAdmin(), h(async (req, res) => {
  const { status, take } = z.object({
    status: z.string().optional(), take: z.coerce.number().default(50),
  }).parse(req.query);
  const bookings = await db.booking.findMany({
    where: status ? { status: status as never } : {},
    include: {
      customer: { select: { name: true, phone: true } },
      worker: { include: { user: { select: { name: true } } } },
      zone: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' }, take,
  });
  res.json({ bookings });
}));

adminRouter.get('/bookings/:id', requireAdmin(), h(async (req, res) => {
  const booking = await db.booking.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true, address: true, zone: true,
      worker: { include: { user: true } },
      events: { orderBy: { at: 'asc' } },
      payments: true, offers: { include: { worker: { include: { user: { select: { name: true } } } } } },
      ratings: true,
    },
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  res.json({ booking });
}));

adminRouter.post('/bookings/:id/refund', requireAdmin('SUPPORT', 'FINANCE', 'CITY_OPS'), h(async (req, res) => {
  const { amountPaise, reason } = z.object({ amountPaise: z.number().positive(), reason: z.string().min(3) }).parse(req.body);
  const payment = await db.payment.findFirst({ where: { bookingId: req.params.id, status: 'PAID', purpose: 'booking' } });
  if (!payment) throw new HttpError(404, 'No paid payment on this booking');
  if (amountPaise > payment.amountPaise - payment.refundPaise) throw new HttpError(400, 'Refund exceeds remaining amount');
  const updated = await db.payment.update({
    where: { id: payment.id },
    data: {
      refundPaise: payment.refundPaise + amountPaise,
      status: payment.refundPaise + amountPaise >= payment.amountPaise ? 'REFUNDED' : 'PARTIAL_REFUND',
    },
  });
  await audit(req.auth!.sub, 'refund', 'payment', payment.id, { refund: payment.refundPaise }, { refund: updated.refundPaise, reason });
  res.json({ payment: updated });
}));

// ───────────────────────── Workforce ─────────────────────────

adminRouter.get('/workers', requireAdmin(), h(async (req, res) => {
  const { status } = z.object({ status: z.string().optional() }).parse(req.query);
  const workers = await db.worker.findMany({
    where: status ? { status: status as never } : {},
    include: { user: { select: { name: true, phone: true } }, hub: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ workers });
}));

adminRouter.get('/workers/:id', requireAdmin(), h(async (req, res) => {
  const worker = await db.worker.findUnique({
    where: { id: req.params.id },
    include: {
      user: true, hub: true, kycDocs: true,
      trainings: { include: { module: { select: { title: true } } } },
      earnings: { orderBy: { createdAt: 'desc' }, take: 20 },
      bookings: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, tasks: true, createdAt: true } },
      attendance: { orderBy: { checkinAt: 'desc' }, take: 14 },
    },
  });
  if (!worker) throw new HttpError(404, 'Worker not found');
  res.json({ worker });
}));

/** KYC review (verifier role). Approving all docs moves NEW→TRAINING pipeline forward. */
adminRouter.post('/workers/:id/kyc/:docId', requireAdmin('VERIFIER', 'CITY_OPS'), h(async (req, res) => {
  const { approve, reason } = z.object({ approve: z.boolean(), reason: z.string().optional() }).parse(req.body);
  const doc = await db.kycDoc.update({
    where: { id: req.params.docId },
    data: { status: approve ? 'APPROVED' : 'REJECTED', reason, reviewedBy: req.auth!.sub },
  });
  const worker = await db.worker.findUniqueOrThrow({ where: { id: req.params.id }, include: { kycDocs: true } });
  if (worker.status === 'UNDER_REVIEW') {
    if (worker.kycDocs.every(d => d.status === 'APPROVED')) {
      await db.worker.update({ where: { id: worker.id }, data: { status: 'TRAINING' } });
    } else if (worker.kycDocs.some(d => d.status === 'REJECTED')) {
      // stays UNDER_REVIEW; worker resubmits
    }
  }
  await audit(req.auth!.sub, approve ? 'kyc-approve' : 'kyc-reject', 'kycDoc', doc.id);
  res.json({ doc });
}));

adminRouter.post('/workers/:id/status', requireAdmin('CITY_OPS'), h(async (req, res) => {
  const { status, hubId } = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'TRAINING']).optional(),
    hubId: z.string().optional(),
  }).parse(req.body);
  const before = await db.worker.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, 'Worker not found');
  const worker = await db.worker.update({
    where: { id: req.params.id },
    data: { ...(status ? { status, duty: status === 'ACTIVE' ? before.duty : 'OFF_DUTY' } : {}), ...(hubId ? { hubId } : {}) },
  });
  await audit(req.auth!.sub, 'worker-status', 'worker', worker.id, { status: before.status }, { status: worker.status, hubId });
  res.json({ worker });
}));

// Roster
adminRouter.post('/shifts', requireAdmin('CITY_OPS', 'HUB_SUPERVISOR'), h(async (req, res) => {
  const body = z.object({
    workerId: z.string(), hubId: z.string(),
    startAt: z.string().datetime(), endAt: z.string().datetime(),
  }).parse(req.body);
  const shift = await db.shift.create({
    data: { workerId: body.workerId, hubId: body.hubId, startAt: new Date(body.startAt), endAt: new Date(body.endAt) },
  });
  res.json({ shift });
}));

adminRouter.get('/shifts', requireAdmin(), h(async (req, res) => {
  const shifts = await db.shift.findMany({
    where: { endAt: { gte: new Date(Date.now() - 86_400_000) } },
    include: { worker: { include: { user: { select: { name: true } } } }, hub: { select: { name: true } } },
    orderBy: { startAt: 'asc' },
  });
  res.json({ shifts });
}));

adminRouter.get('/leaves', requireAdmin('CITY_OPS', 'HUB_SUPERVISOR'), h(async (_req, res) => {
  const leaves = await db.leave.findMany({
    where: { status: 'PENDING' },
    include: { worker: { include: { user: { select: { name: true } } } } },
  });
  res.json({ leaves });
}));

adminRouter.post('/leaves/:id/decide', requireAdmin('CITY_OPS', 'HUB_SUPERVISOR'), h(async (req, res) => {
  const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
  const leave = await db.leave.update({
    where: { id: req.params.id },
    data: { status: approve ? 'APPROVED' : 'REJECTED', decidedBy: req.auth!.sub },
  });
  res.json({ leave });
}));

// ───────────────────────── Customers ─────────────────────────

adminRouter.get('/customers', requireAdmin(), h(async (req, res) => {
  const { q } = z.object({ q: z.string().optional() }).parse(req.query);
  const customers = await db.user.findMany({
    where: {
      role: 'CUSTOMER',
      ...(q ? { OR: [{ phone: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: 'desc' }, take: 50,
  });
  res.json({ customers });
}));

adminRouter.get('/customers/:id', requireAdmin(), h(async (req, res) => {
  const customer = await db.user.findUnique({
    where: { id: req.params.id },
    include: {
      addresses: true,
      bookings: { orderBy: { createdAt: 'desc' }, take: 20, include: { zone: { select: { name: true } } } },
      tickets: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!customer) throw new HttpError(404, 'Customer not found');
  const ltv = await db.booking.aggregate({ where: { customerId: customer.id, status: { in: ['COMPLETED', 'RATED'] } }, _sum: { totalPaise: true } });
  res.json({ customer, ltvPaise: ltv._sum.totalPaise ?? 0 });
}));

adminRouter.post('/customers/:id/flags', requireAdmin('CITY_OPS', 'SUPPORT'), h(async (req, res) => {
  const { banned, fraudFlag, creditPaise } = z.object({
    banned: z.boolean().optional(), fraudFlag: z.boolean().optional(), creditPaise: z.number().optional(),
  }).parse(req.body);
  const before = await db.user.findUnique({ where: { id: req.params.id } });
  const user = await db.user.update({
    where: { id: req.params.id },
    data: {
      ...(banned !== undefined ? { banned } : {}),
      ...(fraudFlag !== undefined ? { fraudFlag } : {}),
      ...(creditPaise ? { creditsPaise: { increment: creditPaise } } : {}),
    },
  });
  await audit(req.auth!.sub, 'customer-flags', 'user', user.id, before, { banned, fraudFlag, creditPaise });
  res.json({ user });
}));

// ───────────────────────── Catalog / pricing / zones / coupons ─────────────────────────

adminRouter.get('/services', requireAdmin(), h(async (_req, res) => {
  const services = await db.service.findMany({ orderBy: { order: 'asc' } });
  res.json({ services });
}));

adminRouter.post('/services', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    slug: z.string(), name: z.string(), category: z.string(),
    icon: z.string().default('broom'), baseMinutes: z.number().default(30), order: z.number().default(0),
  }).parse(req.body);
  const service = await db.service.create({ data: body });
  await audit(req.auth!.sub, 'create', 'service', service.id, null, body);
  res.json({ service });
}));

adminRouter.patch('/services/:id', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    name: z.string().optional(), icon: z.string().optional(),
    baseMinutes: z.number().optional(), active: z.boolean().optional(), order: z.number().optional(),
  }).parse(req.body);
  const service = await db.service.update({ where: { id: req.params.id }, data: body });
  await audit(req.auth!.sub, 'update', 'service', service.id, null, body);
  res.json({ service });
}));

adminRouter.put('/pricing', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    cityId: z.string(), durationMin: z.number(), pricePaise: z.number(), surgeMultiplier: z.number().default(1),
  }).parse(req.body);
  const pricing = await db.pricing.upsert({
    where: { cityId_durationMin: { cityId: body.cityId, durationMin: body.durationMin } },
    create: body, update: { pricePaise: body.pricePaise, surgeMultiplier: body.surgeMultiplier },
  });
  await audit(req.auth!.sub, 'upsert', 'pricing', pricing.id, null, body);
  res.json({ pricing });
}));

adminRouter.get('/cities', requireAdmin(), h(async (_req, res) => {
  const cities = await db.city.findMany({ include: { zones: true, hubs: true } });
  res.json({ cities });
}));

adminRouter.post('/zones', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    cityId: z.string(), name: z.string(), polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  }).parse(req.body);
  const zone = await db.zone.create({ data: body });
  await audit(req.auth!.sub, 'create', 'zone', zone.id, null, { name: body.name });
  res.json({ zone });
}));

adminRouter.patch('/zones/:id', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    name: z.string().optional(), active: z.boolean().optional(),
    polygon: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
  }).parse(req.body);
  const zone = await db.zone.update({ where: { id: req.params.id }, data: body });
  await audit(req.auth!.sub, 'update', 'zone', zone.id, null, body);
  res.json({ zone });
}));

adminRouter.post('/hubs', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    cityId: z.string(), zoneId: z.string().optional(), name: z.string(),
    lat: z.number(), lng: z.number(), capacity: z.number().default(10),
  }).parse(req.body);
  const hub = await db.hub.create({ data: body });
  res.json({ hub });
}));

adminRouter.get('/coupons', requireAdmin(), h(async (_req, res) => {
  res.json({ coupons: await db.coupon.findMany({ orderBy: { code: 'asc' } }) });
}));

adminRouter.post('/coupons', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    code: z.string().min(3), description: z.string(),
    discountPct: z.number().default(0), discountPaise: z.number().default(0),
    maxDiscountPaise: z.number().default(10000), minOrderPaise: z.number().default(0),
    firstBookingOnly: z.boolean().default(false), usageLimit: z.number().default(0),
    expiresAt: z.string().datetime().optional(),
  }).parse(req.body);
  const coupon = await db.coupon.create({
    data: { ...body, code: body.code.toUpperCase(), expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined },
  });
  await audit(req.auth!.sub, 'create', 'coupon', coupon.id, null, body);
  res.json({ coupon });
}));

adminRouter.patch('/coupons/:id', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const coupon = await db.coupon.update({ where: { id: req.params.id }, data: { active } });
  res.json({ coupon });
}));

// ───────────────────────── CMS / platform ─────────────────────────

adminRouter.post('/banners', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    imageUrl: z.string().url(), title: z.string(), deeplink: z.string().optional(), order: z.number().default(0),
  }).parse(req.body);
  res.json({ banner: await db.banner.create({ data: body }) });
}));

adminRouter.post('/announcements', requireAdmin('SUPER_ADMIN', 'CITY_OPS'), h(async (req, res) => {
  const body = z.object({
    audience: z.enum(['workers', 'customers']), title: z.string(), body: z.string(),
  }).parse(req.body);
  res.json({ announcement: await db.announcement.create({ data: body }) });
}));

adminRouter.get('/flags', requireAdmin(), h(async (_req, res) => {
  res.json({ flags: await db.featureFlag.findMany() });
}));

adminRouter.put('/flags/:key', requireAdmin('SUPER_ADMIN'), h(async (req, res) => {
  const { value } = z.object({ value: z.unknown() }).parse(req.body);
  const flag = await db.featureFlag.upsert({
    where: { key: req.params.key },
    create: { key: req.params.key, value: value as never },
    update: { value: value as never },
  });
  await audit(req.auth!.sub, 'flag', 'featureFlag', flag.key, null, { value });
  res.json({ flag });
}));

adminRouter.get('/admins', requireAdmin('SUPER_ADMIN'), h(async (_req, res) => {
  const admins = await db.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, cityId: true, active: true },
  });
  res.json({ admins });
}));

adminRouter.post('/admins', requireAdmin('SUPER_ADMIN'), h(async (req, res) => {
  const body = z.object({
    email: z.string().email(), name: z.string(), password: z.string().min(6),
    role: z.enum(['SUPER_ADMIN', 'CITY_OPS', 'HUB_SUPERVISOR', 'SUPPORT', 'FINANCE', 'VERIFIER']),
    cityId: z.string().optional(), hubId: z.string().optional(),
  }).parse(req.body);
  const admin = await db.adminUser.create({
    data: { email: body.email, name: body.name, passwordHash: sha(body.password), role: body.role, cityId: body.cityId, hubId: body.hubId },
  });
  await audit(req.auth!.sub, 'create', 'adminUser', admin.id, null, { email: body.email, role: body.role });
  res.json({ admin: { id: admin.id, email: admin.email, role: admin.role } });
}));

adminRouter.get('/audit', requireAdmin('SUPER_ADMIN'), h(async (_req, res) => {
  res.json({ logs: await db.auditLog.findMany({ orderBy: { at: 'desc' }, take: 200 }) });
}));

// ───────────────────────── Analytics ─────────────────────────

adminRouter.get('/analytics', requireAdmin(), h(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const bookings = await db.booking.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true, totalPaise: true, completedAt: true },
  });
  const byDay: Record<string, { count: number; completed: number; gmvPaise: number }> = {};
  for (const b of bookings) {
    const day = b.createdAt.toISOString().slice(0, 10);
    byDay[day] ??= { count: 0, completed: 0, gmvPaise: 0 };
    byDay[day].count++;
    if (b.status === 'COMPLETED' || b.status === 'RATED') {
      byDay[day].completed++;
      byDay[day].gmvPaise += b.totalPaise;
    }
  }
  const cancellations = await db.bookingEvent.groupBy({
    by: ['toStatus'], where: { toStatus: { startsWith: 'CANCELLED' }, at: { gte: since } }, _count: true,
  });
  const ratings = await db.rating.groupBy({
    by: ['stars'], where: { direction: 'customer_to_worker', createdAt: { gte: since } }, _count: true,
  });
  const fillRate = bookings.length
    ? 1 - bookings.filter(b => b.status === 'NO_EXPERT_FOUND').length / bookings.length
    : 1;
  const repeatCustomers = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM (
      SELECT "customerId" FROM "Booking" GROUP BY "customerId" HAVING COUNT(*) > 1
    ) t`;
  res.json({
    byDay, cancellations, ratings,
    fillRatePct: Math.round(fillRate * 100),
    repeatCustomers: Number(repeatCustomers[0]?.count ?? 0),
  });
}));
