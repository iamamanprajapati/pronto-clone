import { canTransition, channels, EV, type BookingActor, type BookingStatus, type BookingUpdate } from '@pronto/shared';
import { db } from '../db';
import { emitTo } from '../realtime/gateway';
import { HttpError } from '../middleware/errors';
import { bookingTemplates, notify } from './notifications';

const actorStr = (a: BookingActor) => (a.kind === 'system' ? 'system' : `${a.kind}:${a.id}`);

/**
 * THE single path for booking status changes across the whole platform.
 * Validates the edge, appends to booking_events, fans out to sockets +
 * notifications. Customer app, worker app, admin and system timers all
 * route through here.
 */
export async function transition(
  bookingId: string,
  to: BookingStatus,
  actor: BookingActor,
  meta: Record<string, unknown> = {},
) {
  const result = await db.$transaction(async tx => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (!canTransition(booking.status as BookingStatus, to)) {
      throw new HttpError(409, `Cannot go ${booking.status} → ${to}`, 'INVALID_TRANSITION');
    }

    const data: Record<string, unknown> = { status: to };
    if (to === 'IN_PROGRESS') {
      data.startedAt = new Date();
      data.timerEndsAt = new Date(Date.now() + booking.durationMin * 60_000);
    }
    if (to === 'COMPLETED') data.completedAt = new Date();

    const updated = await tx.booking.update({ where: { id: bookingId }, data: data as never });
    await tx.bookingEvent.create({
      data: { bookingId, fromStatus: booking.status, toStatus: to, actor: actorStr(actor), meta: meta as never },
    });
    return updated;
  });

  await fanOut(result.id, to, meta);
  return result;
}

async function fanOut(bookingId: string, status: BookingStatus, meta: Record<string, unknown>) {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { worker: { include: { user: true } }, zone: true },
  });

  const update: BookingUpdate = {
    bookingId,
    status,
    worker: booking.worker
      ? {
          id: booking.worker.id,
          name: booking.worker.user.name ?? 'Expert',
          rating: booking.worker.rating,
          photoUrl: booking.worker.photoUrl,
          jobsDone: booking.worker.jobsDone,
        }
      : null,
    timerEndsAt: booking.timerEndsAt?.toISOString() ?? null,
    meta,
  };

  emitTo(channels.booking(bookingId), EV.BOOKING_UPDATE, update);
  if (booking.workerId) emitTo(channels.workerJobs(booking.workerId), EV.BOOKING_UPDATE, update);
  emitTo(channels.adminFirehose(booking.zone.cityId), EV.ADMIN_EVENT, { type: 'booking', ...update });

  const template = bookingTemplates[status]?.({ workerName: booking.worker?.user.name ?? undefined });
  if (template) await notify(booking.customerId, 'push', template.title, template.body);
}

export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
