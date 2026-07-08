import { Router } from 'express';
import { z } from 'zod';
import {
  channels, DISPATCH_RADIUS_M, EV, MAX_OFFER_ROUNDS, OFFER_TTL_SECONDS, type JobOffer,
} from '@pronto/shared';
import { db } from '../db';
import { geoKey, offerLockKey, redis } from '../redis';
import { emitTo } from '../realtime/gateway';
import { transition, generateOtp } from './bookingService';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { notify } from './notifications';
import { offerTimeoutQueue } from '../jobs/queues';

/**
 * DISPATCH ENGINE
 * candidates (Redis GEO) → score → offer (TTL) → resolve/next → exhausted.
 * Workers are full-time & auto-assigned; decline is an exception path.
 */

interface Candidate {
  workerId: string;
  distanceM: number;
  rating: number;
  idleSince: number;
  skills: string[];
}

async function findCandidates(booking: {
  id: string; zoneId: string; tasks: string[]; customerId: string; durationMin: number;
}, lat: number, lng: number): Promise<Candidate[]> {
  const raw = (await redis.geosearch(
    geoKey(booking.zoneId), 'FROMLONLAT', lng, lat, 'BYRADIUS', DISPATCH_RADIUS_M, 'm', 'ASC', 'WITHCOORD', 'WITHDIST',
  )) as [string, string, [string, string]][];

  const taskCategories = await db.service.findMany({
    where: { slug: { in: booking.tasks } }, select: { category: true },
  });
  const neededCats = [...new Set(taskCategories.map(t => t.category))];

  const blocked = await db.blockedWorker.findMany({ where: { userId: booking.customerId } });
  const blockedIds = new Set(blocked.map(b => b.workerId));

  const declined = await db.offer.findMany({
    where: { bookingId: booking.id, response: { in: ['DECLINED', 'TIMEOUT'] } }, select: { workerId: true },
  });
  const declinedIds = new Set(declined.map(d => d.workerId));

  const candidates: Candidate[] = [];
  for (const [member, dist] of raw) {
    const workerId = member.replace('worker:', '');
    if (blockedIds.has(workerId) || declinedIds.has(workerId)) continue;

    const live = await redis.hgetall(`worker:${workerId}:live`);
    if (live.duty !== 'IDLE') continue;

    const worker = await db.worker.findUnique({ where: { id: workerId } });
    if (!worker || worker.status !== 'ACTIVE' || worker.duty !== 'IDLE') continue;
    if (!neededCats.every(c => worker.skills.includes(c))) continue;

    // Shift must cover the job duration
    const shift = await db.shift.findFirst({
      where: { workerId, startAt: { lte: new Date() }, endAt: { gte: new Date(Date.now() + booking.durationMin * 60_000) } },
    });
    const anyShift = await db.shift.count({ where: { workerId } });
    if (anyShift > 0 && !shift) continue; // no roster rows at all = dev mode, allow

    candidates.push({
      workerId,
      distanceM: Math.round(Number(dist)),
      rating: worker.rating,
      idleSince: Number(live.idleSince ?? Date.now()),
      skills: worker.skills,
    });
  }
  return candidates;
}

/** score = distance + fairness (idle time) + quality. Lower is better. */
function score(c: Candidate): number {
  const idleMin = (Date.now() - c.idleSince) / 60_000;
  return c.distanceM * 1.0 - Math.min(idleMin, 120) * 20 - c.rating * 100;
}

export async function dispatchBooking(bookingId: string): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { address: true, customer: true, zone: true },
  });
  if (booking.status !== 'SEARCHING') return;
  if (booking.offerRound >= MAX_OFFER_ROUNDS) {
    await transition(bookingId, 'NO_EXPERT_FOUND', { kind: 'system' }, { reason: 'offer rounds exhausted' });
    return;
  }

  const candidates = await findCandidates(booking, booking.address.lat, booking.address.lng);
  if (candidates.length === 0) {
    await transition(bookingId, 'NO_EXPERT_FOUND', { kind: 'system' }, { reason: 'no candidates in radius' });
    return;
  }
  candidates.sort((a, b) => score(a) - score(b));

  for (const c of candidates) {
    // one live offer per worker at a time
    const locked = await redis.set(offerLockKey(c.workerId), bookingId, 'EX', OFFER_TTL_SECONDS + 5, 'NX');
    if (!locked) continue;

    const round = booking.offerRound + 1;
    const payoutPaise = Math.round(booking.basePaise * 0.65); // worker share of base
    const offer = await db.offer.create({
      data: {
        bookingId, workerId: c.workerId, round, payoutPaise,
        distanceM: c.distanceM, expiresAt: new Date(Date.now() + OFFER_TTL_SECONDS * 1000),
      },
    });
    await db.booking.update({ where: { id: bookingId }, data: { offerRound: round } });
    await db.worker.update({ where: { id: c.workerId }, data: { duty: 'OFFERED' } });
    await redis.hset(`worker:${c.workerId}:live`, 'duty', 'OFFERED');

    const tasks = await db.service.findMany({ where: { slug: { in: booking.tasks } } });
    const payload: JobOffer = {
      offerId: offer.id,
      bookingId,
      tasks: tasks.map(t => t.name),
      durationMin: booking.durationMin,
      payoutPaise,
      distanceM: c.distanceM,
      address: { landmark: booking.address.landmark, lat: booking.address.lat, lng: booking.address.lng },
      customerFirstName: (booking.customer.name ?? 'Customer').split(' ')[0],
      customerRating: null,
      expiresAt: offer.expiresAt.toISOString(),
    };
    emitTo(channels.workerJobs(c.workerId), EV.JOB_OFFER, payload);
    const workerUser = await db.worker.findUnique({ where: { id: c.workerId }, select: { userId: true } });
    if (workerUser) await notify(workerUser.userId, 'push', 'New job 🔔', `${payload.tasks.join(', ')} · ${booking.durationMin} min · ${c.distanceM}m away`);

    // Server-side TTL: if no response, the timeout job moves to the next candidate
    await offerTimeoutQueue.add('timeout', { offerId: offer.id }, { delay: OFFER_TTL_SECONDS * 1000 });
    return; // one offer at a time
  }

  // everyone locked/unavailable → treat round as burned and retry once more
  await db.booking.update({ where: { id: bookingId }, data: { offerRound: { increment: 1 } } });
  await dispatchBooking(bookingId);
}

/** Called by the BullMQ worker when an offer TTL fires. */
export async function handleOfferTimeout(offerId: string) {
  const offer = await db.offer.findUnique({ where: { id: offerId } });
  if (!offer || offer.response !== 'PENDING') return;
  await db.offer.update({ where: { id: offerId }, data: { response: 'TIMEOUT' } });
  await releaseWorker(offer.workerId);
  emitTo(channels.workerJobs(offer.workerId), EV.JOB_OFFER_WITHDRAWN, { offerId });
  await dispatchBooking(offer.bookingId);
}

async function releaseWorker(workerId: string) {
  await db.worker.update({ where: { id: workerId }, data: { duty: 'IDLE' } });
  await redis.hset(`worker:${workerId}:live`, 'duty', 'IDLE', 'idleSince', Date.now());
  await redis.del(offerLockKey(workerId));
}

// ───────────────────────── Routes ─────────────────────────

export const dispatchRouter = Router();

/** Worker responds to an offer. */
dispatchRouter.post('/offers/:id/respond', requireAuth('WORKER'), h(async (req, res) => {
  const { accept, reason } = z.object({ accept: z.boolean(), reason: z.string().optional() }).parse(req.body);
  const offer = await db.offer.findUnique({ where: { id: req.params.id }, include: { booking: true } });
  if (!offer || offer.workerId !== req.auth!.workerId) throw new HttpError(404, 'Offer not found');
  if (offer.response !== 'PENDING') throw new HttpError(409, 'Offer already resolved');
  if (offer.expiresAt < new Date()) throw new HttpError(409, 'Offer expired');

  if (!accept) {
    await db.offer.update({ where: { id: offer.id }, data: { response: 'DECLINED', reason: reason ?? 'unspecified' } });
    await releaseWorker(offer.workerId);
    await dispatchBooking(offer.bookingId);
    return res.json({ ok: true });
  }

  const otp = generateOtp();
  await db.offer.update({ where: { id: offer.id }, data: { response: 'ACCEPTED' } });
  await db.booking.update({ where: { id: offer.bookingId }, data: { workerId: offer.workerId, otp } });
  await db.worker.update({ where: { id: offer.workerId }, data: { duty: 'EN_ROUTE' } });
  await redis.hset(`worker:${offer.workerId}:live`, 'duty', 'EN_ROUTE');
  await redis.del(offerLockKey(offer.workerId));
  await transition(offer.bookingId, 'ASSIGNED', { kind: 'worker', id: offer.workerId });
  await transition(offer.bookingId, 'EN_ROUTE', { kind: 'worker', id: offer.workerId });
  res.json({ ok: true, bookingId: offer.bookingId });
}));

export { releaseWorker };
