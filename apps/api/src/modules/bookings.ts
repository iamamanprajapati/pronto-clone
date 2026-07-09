import { Router } from 'express';
import { z } from 'zod';
import {
  AUTO_COMPLETE_GRACE_MIN, EXTENSION_BLOCKS_MIN, FREE_CANCEL_MINUTES, isCancellable,
  JOB_OVERRUN_SAFETY_PING_MIN, LATE_CANCEL_FEE_PAISE, UNPAID_BOOKING_EXPIRY_MIN,
  type BookingStatus,
} from '@pronto/shared';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { computeQuote, zoneForPoint } from './catalog';
import { transition } from './bookingService';
import { dispatchBooking, releaseWorker } from './dispatch';
import { bookingTimersQueue } from '../jobs/queues';
import { settleCompletion } from './earnings';
import { config } from '../config';
import { anchorKey, redis } from '../redis';

export const bookingsRouter = Router();

async function toDTO(bookingId: string, viewerRole: 'CUSTOMER' | 'WORKER') {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { address: true, worker: { include: { user: true } } },
  });
  const services = await db.service.findMany({ where: { slug: { in: b.tasks } } });
  return {
    id: b.id,
    status: b.status,
    tasks: b.tasks,
    taskNames: services.map(s => s.name),
    durationMin: b.durationMin,
    scheduledAt: b.scheduledAt?.toISOString() ?? null,
    instructions: b.instructions,
    address: { id: b.address.id, tag: b.address.tag, lat: b.address.lat, lng: b.address.lng, flat: b.address.flat, landmark: b.address.landmark },
    worker: b.worker
      ? { id: b.worker.id, name: b.worker.user.name ?? 'Expert', rating: b.worker.rating, photoUrl: b.worker.photoUrl, jobsDone: b.worker.jobsDone }
      : null,
    // customers see the OTP (they hand it to the worker); workers never do
    otp: viewerRole === 'CUSTOMER' ? b.otp : null,
    pricing: { basePaise: b.basePaise, extensionPaise: b.extensionPaise, discountPaise: b.discountPaise, tipPaise: b.tipPaise, totalPaise: b.totalPaise },
    startedAt: b.startedAt?.toISOString() ?? null,
    timerEndsAt: b.timerEndsAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

// ───────────────────────── Customer endpoints ─────────────────────────

bookingsRouter.post('/', requireAuth('CUSTOMER'), h(async (req, res) => {
  const body = z.object({
    addressId: z.string(),
    tasks: z.array(z.string()).min(1),
    durationMin: z.number(),
    scheduledAt: z.string().datetime().optional(),
    instructions: z.string().max(500).optional(),
    coupon: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }).parse(req.body);

  // idempotency: same key returns the same booking
  if (body.idempotencyKey) {
    const cached = await redis.get(`idem:booking:${body.idempotencyKey}`);
    if (cached) return res.json({ booking: await toDTO(cached, 'CUSTOMER') });
  }

  const address = await db.address.findFirst({ where: { id: body.addressId, userId: req.auth!.sub } });
  if (!address) throw new HttpError(404, 'Address not found');
  let zone = await zoneForPoint(address.lat, address.lng);

  // Dev: move the destination to the customer's live location (the anchor) so the
  // tracking map shows the right place and the worker heads to where they actually
  // are. Falls back to the demo zone. Production requires a real serviceable address.
  if (config.isDev) {
    if (!zone) zone = await zoneForPoint(12.9116, 77.6389) ?? (await db.zone.findFirst({ where: { active: true }, include: { city: true } }));
    const raw = zone && await redis.get(anchorKey(zone.id));
    if (raw) {
      const a = JSON.parse(raw) as { lat: number; lng: number };
      await db.address.update({ where: { id: address.id }, data: { lat: a.lat, lng: a.lng } });
      address.lat = a.lat; address.lng = a.lng;
    }
  }
  if (!zone) throw new HttpError(400, 'Address is outside our serviceable areas');

  const quote = await computeQuote({
    cityId: zone.cityId, durationMin: body.durationMin,
    couponCode: body.coupon, customerId: req.auth!.sub,
  });

  const booking = await db.booking.create({
    data: {
      customerId: req.auth!.sub,
      addressId: address.id,
      zoneId: zone.id,
      tasks: body.tasks,
      durationMin: body.durationMin,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      instructions: body.instructions,
      basePaise: quote.basePaise,
      discountPaise: quote.discountPaise,
      totalPaise: quote.totalPaise,
      couponCode: quote.couponCode,
    },
  });
  await db.bookingEvent.create({
    data: { bookingId: booking.id, fromStatus: '-', toStatus: 'CREATED', actor: `customer:${req.auth!.sub}` },
  });
  if (quote.couponCode) {
    await db.coupon.update({ where: { code: quote.couponCode }, data: { usedCount: { increment: 1 } } });
  }
  if (body.idempotencyKey) {
    await redis.set(`idem:booking:${body.idempotencyKey}`, booking.id, 'EX', 3600);
  }

  await transition(booking.id, 'PAYMENT_PENDING', { kind: 'customer', id: req.auth!.sub });
  await bookingTimersQueue.add('t', { type: 'unpaid-expiry', bookingId: booking.id }, { delay: UNPAID_BOOKING_EXPIRY_MIN * 60_000 });

  res.json({ booking: await toDTO(booking.id, 'CUSTOMER') });
}));

/** Called by the payments module after successful payment. */
export async function onBookingPaid(bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.status !== 'PAYMENT_PENDING') return;
  await transition(bookingId, 'SEARCHING', { kind: 'system' }, { reason: 'payment confirmed' });
  if (booking.scheduledAt && booking.scheduledAt.getTime() - Date.now() > 15 * 60_000) {
    // scheduled: dispatch at T-15min
    await bookingTimersQueue.add('t',
      { type: 'scheduled-dispatch', bookingId },
      { delay: booking.scheduledAt.getTime() - Date.now() - 15 * 60_000 });
  } else {
    await dispatchBooking(bookingId);
  }
}

bookingsRouter.get('/', requireAuth('CUSTOMER'), h(async (req, res) => {
  const bookings = await db.booking.findMany({
    where: { customerId: req.auth!.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true },
  });
  res.json({ bookings: await Promise.all(bookings.map(b => toDTO(b.id, 'CUSTOMER'))) });
}));

bookingsRouter.get('/:id', requireAuth('CUSTOMER', 'WORKER'), h(async (req, res) => {
  const b = await db.booking.findUnique({ where: { id: req.params.id } });
  if (!b) throw new HttpError(404, 'Booking not found');
  const role = req.auth!.role as 'CUSTOMER' | 'WORKER';
  const mine = role === 'CUSTOMER' ? b.customerId === req.auth!.sub : b.workerId === req.auth!.workerId;
  if (!mine) throw new HttpError(403, 'Not your booking');
  res.json({ booking: await toDTO(b.id, role) });
}));

bookingsRouter.get('/:id/timeline', requireAuth('CUSTOMER', 'WORKER'), h(async (req, res) => {
  const events = await db.bookingEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { at: 'asc' } });
  res.json({ events });
}));

bookingsRouter.post('/:id/cancel', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().default('unspecified') }).parse(req.body);
  const b = await db.booking.findFirst({ where: { id: req.params.id, customerId: req.auth!.sub } });
  if (!b) throw new HttpError(404, 'Booking not found');
  if (!isCancellable(b.status as BookingStatus)) throw new HttpError(409, 'This booking can no longer be cancelled');

  // free-cancel window applies to scheduled bookings; instant ones charge after assignment
  const start = b.scheduledAt ?? b.createdAt;
  const lateFee =
    (b.status === 'ASSIGNED' || b.status === 'EN_ROUTE' || b.status === 'ARRIVED') &&
    start.getTime() - Date.now() < FREE_CANCEL_MINUTES * 60_000
      ? LATE_CANCEL_FEE_PAISE : 0;

  if (b.workerId) await releaseWorker(b.workerId);
  await db.booking.update({ where: { id: b.id }, data: { lateFeePaise: lateFee } });
  await transition(b.id, 'CANCELLED_CUSTOMER', { kind: 'customer', id: req.auth!.sub }, { reason, lateFee });

  // refund paid amount minus fee
  const paid = await db.payment.findFirst({ where: { bookingId: b.id, status: 'PAID', purpose: 'booking' } });
  if (paid) {
    const refund = Math.max(0, paid.amountPaise - lateFee);
    await db.payment.update({
      where: { id: paid.id },
      data: { refundPaise: refund, status: refund === paid.amountPaise ? 'REFUNDED' : 'PARTIAL_REFUND' },
    });
  }
  res.json({ ok: true, lateFeePaise: lateFee });
}));

bookingsRouter.post('/:id/reschedule', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { scheduledAt } = z.object({ scheduledAt: z.string().datetime() }).parse(req.body);
  const b = await db.booking.findFirst({ where: { id: req.params.id, customerId: req.auth!.sub } });
  if (!b) throw new HttpError(404, 'Booking not found');
  if (!['SEARCHING', 'ASSIGNED'].includes(b.status)) throw new HttpError(409, 'Too late to reschedule');
  const start = b.scheduledAt ?? b.createdAt;
  if (start.getTime() - Date.now() < FREE_CANCEL_MINUTES * 60_000 && b.status !== 'SEARCHING') {
    throw new HttpError(409, `Rescheduling closes ${FREE_CANCEL_MINUTES} min before start`);
  }
  if (b.workerId) {
    await releaseWorker(b.workerId);
    await db.booking.update({ where: { id: b.id }, data: { workerId: null, offerRound: 0 } });
    await transition(b.id, 'SEARCHING', { kind: 'customer', id: req.auth!.sub }, { reason: 'rescheduled' });
  }
  const newStart = new Date(scheduledAt);
  await db.booking.update({ where: { id: b.id }, data: { scheduledAt: newStart } });
  await bookingTimersQueue.add('t',
    { type: 'scheduled-dispatch', bookingId: b.id },
    { delay: Math.max(0, newStart.getTime() - Date.now() - 15 * 60_000) });
  res.json({ booking: await toDTO(b.id, 'CUSTOMER') });
}));

/** Mid-service paid extension. */
bookingsRouter.post('/:id/extend', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { minutes } = z.object({ minutes: z.number().refine(m => (EXTENSION_BLOCKS_MIN as readonly number[]).includes(m)) }).parse(req.body);
  const b = await db.booking.findFirst({
    where: { id: req.params.id, customerId: req.auth!.sub }, include: { zone: true },
  });
  if (!b || b.status !== 'IN_PROGRESS') throw new HttpError(409, 'Extension only during an active service');

  // simple pro-rata price from the 60-min block
  const hourPrice = await db.pricing.findUnique({ where: { cityId_durationMin: { cityId: b.zone.cityId, durationMin: 60 } } });
  const extPaise = Math.round(((hourPrice?.pricePaise ?? 16900) * minutes) / 60);

  await db.booking.update({
    where: { id: b.id },
    data: {
      durationMin: b.durationMin + minutes,
      extensionPaise: b.extensionPaise + extPaise,
      totalPaise: b.totalPaise + extPaise,
      timerEndsAt: new Date((b.timerEndsAt ?? new Date()).getTime() + minutes * 60_000),
    },
  });
  await db.payment.create({
    data: { bookingId: b.id, amountPaise: extPaise, purpose: 'extension', status: 'PAID', method: 'upi' },
  });
  await transition(b.id, 'IN_PROGRESS' as never, { kind: 'customer', id: req.auth!.sub }, { extended: minutes })
    .catch(() => { /* IN_PROGRESS→IN_PROGRESS isn't a real edge; emit update manually */ });
  res.json({ booking: await toDTO(b.id, 'CUSTOMER'), extensionPaise: extPaise });
}));

bookingsRouter.post('/:id/rate', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { stars, tags, comment, tipPaise } = z.object({
    stars: z.number().min(1).max(5),
    tags: z.array(z.string()).default([]),
    comment: z.string().optional(),
    tipPaise: z.number().min(0).default(0),
  }).parse(req.body);
  const b = await db.booking.findFirst({ where: { id: req.params.id, customerId: req.auth!.sub } });
  if (!b || b.status !== 'COMPLETED') throw new HttpError(409, 'Booking is not awaiting a rating');

  await db.rating.create({
    data: { bookingId: b.id, raterId: req.auth!.sub, direction: 'customer_to_worker', stars, tags, comment },
  });
  if (b.workerId) {
    const w = await db.worker.findUniqueOrThrow({ where: { id: b.workerId } });
    await db.worker.update({
      where: { id: w.id },
      data: {
        rating: (w.rating * w.ratingCount + stars) / (w.ratingCount + 1),
        ratingCount: w.ratingCount + 1,
      },
    });
    if (tipPaise > 0) {
      await db.booking.update({ where: { id: b.id }, data: { tipPaise, totalPaise: b.totalPaise + tipPaise } });
      await db.payment.create({ data: { bookingId: b.id, amountPaise: tipPaise, purpose: 'tip', status: 'PAID', method: 'upi' } });
      await db.earning.updateMany({
        where: { bookingId: b.id },
        data: { tipPaise, totalPaise: { increment: tipPaise } },
      });
    }
  }
  await transition(b.id, 'RATED', { kind: 'customer', id: req.auth!.sub }, { stars });
  res.json({ ok: true });
}));

// ───────────────────────── Worker job endpoints ─────────────────────────

bookingsRouter.post('/:id/arrive', requireAuth('WORKER'), h(async (req, res) => {
  const b = await db.booking.findFirst({ where: { id: req.params.id, workerId: req.auth!.workerId } });
  if (!b) throw new HttpError(404, 'Job not found');
  await transition(b.id, 'ARRIVED', { kind: 'worker', id: req.auth!.workerId! });
  res.json({ ok: true });
}));

bookingsRouter.post('/:id/start', requireAuth('WORKER'), h(async (req, res) => {
  const { otp } = z.object({ otp: z.string() }).parse(req.body);
  const b = await db.booking.findFirst({ where: { id: req.params.id, workerId: req.auth!.workerId } });
  if (!b) throw new HttpError(404, 'Job not found');
  if (b.otp !== otp) throw new HttpError(400, 'Incorrect OTP');

  await db.worker.update({ where: { id: b.workerId! }, data: { duty: 'ON_JOB' } });
  await redis.hset(`worker:${b.workerId}:live`, 'duty', 'ON_JOB');
  await transition(b.id, 'IN_PROGRESS', { kind: 'worker', id: req.auth!.workerId! });
  // overrun safety ping + auto-complete timers
  const ms = b.durationMin * 60_000;
  await bookingTimersQueue.add('t', { type: 'overrun-safety-ping', bookingId: b.id }, { delay: ms + JOB_OVERRUN_SAFETY_PING_MIN * 60_000 });
  await bookingTimersQueue.add('t', { type: 'auto-complete', bookingId: b.id }, { delay: ms + AUTO_COMPLETE_GRACE_MIN * 60_000 });
  res.json({ ok: true });
}));

bookingsRouter.post('/:id/complete', requireAuth('WORKER'), h(async (req, res) => {
  const { checklist } = z.object({ checklist: z.array(z.object({ task: z.string(), done: z.boolean() })).optional() }).parse(req.body);
  const b = await db.booking.findFirst({ where: { id: req.params.id, workerId: req.auth!.workerId } });
  if (!b) throw new HttpError(404, 'Job not found');
  await transition(b.id, 'COMPLETED', { kind: 'worker', id: req.auth!.workerId! }, { checklist });
  await settleCompletion(b.id);
  res.json({ ok: true });
}));
