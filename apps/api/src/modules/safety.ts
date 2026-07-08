import { Router } from 'express';
import { z } from 'zod';
import { channels, EV } from '@pronto/shared';
import { db } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { emitTo } from '../realtime/gateway';

/**
 * Safety module ("Kavach" layer): SOS from workers or customers during
 * active bookings, system-raised anomalies (job overrun), and the admin
 * acknowledgement → resolution workflow.
 * SOS alerts go out synchronously — never queue-only.
 */

export const safetyRouter = Router();

async function broadcastSos(sosId: string) {
  const sos = await db.sosEvent.findUniqueOrThrow({
    where: { id: sosId },
    include: { worker: { include: { user: true, hub: true } }, booking: { include: { zone: true, address: true } } },
  });
  const cityId = sos.booking?.zone.cityId ?? sos.worker?.hub?.cityId;
  if (cityId) {
    emitTo(channels.adminFirehose(cityId), EV.SOS_ALERT, {
      sosId: sos.id, raisedBy: sos.raisedBy, status: sos.status,
      workerName: sos.worker?.user.name ?? null,
      bookingId: sos.bookingId,
      lat: sos.lat ?? sos.booking?.address.lat, lng: sos.lng ?? sos.booking?.address.lng,
      at: sos.createdAt.toISOString(),
    });
  }
  console.warn(`[SOS] ${sos.raisedBy} sos=${sos.id} booking=${sos.bookingId ?? '-'}`);
}

/** Worker or customer raises SOS. */
safetyRouter.post('/sos', requireAuth('WORKER', 'CUSTOMER'), h(async (req, res) => {
  const { bookingId, lat, lng } = z.object({
    bookingId: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(),
  }).parse(req.body);

  const sos = await db.sosEvent.create({
    data: {
      workerId: req.auth!.role === 'WORKER' ? req.auth!.workerId : undefined,
      bookingId,
      raisedBy: req.auth!.role.toLowerCase(),
      lat, lng,
      timeline: [{ at: new Date().toISOString(), event: 'raised' }],
    },
  });
  await broadcastSos(sos.id);
  res.json({ sosId: sos.id });
}));

/** System-raised anomaly (e.g. job overrun) — called from the timers worker. */
export async function raiseSystemSos(bookingId: string, note: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;
  const sos = await db.sosEvent.create({
    data: {
      workerId: booking.workerId, bookingId,
      raisedBy: 'system:overrun',
      timeline: [{ at: new Date().toISOString(), event: 'raised', note }],
    },
  });
  await broadcastSos(sos.id);
}

// ── Admin workflow ──
safetyRouter.get('/sos', requireAdmin('CITY_OPS', 'SUPPORT'), h(async (req, res) => {
  const status = (req.query.status as string) ?? 'OPEN';
  const events = await db.sosEvent.findMany({
    where: status === 'ALL' ? {} : { status: status as never },
    include: { worker: { include: { user: true } }, booking: { include: { address: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  res.json({ events });
}));

safetyRouter.post('/sos/:id/ack', requireAdmin('CITY_OPS', 'SUPPORT'), h(async (req, res) => {
  const sos = await db.sosEvent.findUnique({ where: { id: req.params.id } });
  if (!sos) throw new HttpError(404, 'SOS not found');
  const timeline = [...(sos.timeline as unknown[]), { at: new Date().toISOString(), event: 'acknowledged', by: req.auth!.sub }];
  const updated = await db.sosEvent.update({
    where: { id: sos.id },
    data: { status: 'ACKNOWLEDGED', assignedTo: req.auth!.sub, timeline: timeline as never },
  });
  res.json({ sos: updated });
}));

safetyRouter.post('/sos/:id/resolve', requireAdmin('CITY_OPS', 'SUPPORT'), h(async (req, res) => {
  const { resolution } = z.object({ resolution: z.string().min(5, 'Resolution note is mandatory') }).parse(req.body);
  const sos = await db.sosEvent.findUnique({ where: { id: req.params.id } });
  if (!sos) throw new HttpError(404, 'SOS not found');
  const timeline = [...(sos.timeline as unknown[]), { at: new Date().toISOString(), event: 'resolved', by: req.auth!.sub }];
  const updated = await db.sosEvent.update({
    where: { id: sos.id },
    data: { status: 'RESOLVED', resolution, timeline: timeline as never },
  });
  res.json({ sos: updated });
}));
