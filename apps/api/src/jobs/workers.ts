import { Worker } from 'bullmq';
import { config } from '../config';
import { db } from '../db';
import { handleOfferTimeout, dispatchBooking } from '../modules/dispatch';
import { transition } from '../modules/bookingService';
import { settleCompletion } from '../modules/earnings';
import { raiseSystemSos } from '../modules/safety';

const connection = { url: config.redisUrl };

/** BullMQ consumers — run in the same process (split out under load). */
export function startJobWorkers() {
  new Worker('offer-timeout', async job => {
    await handleOfferTimeout(job.data.offerId as string);
  }, { connection });

  new Worker('booking-timers', async job => {
    const { type, bookingId } = job.data as { type: string; bookingId: string };
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    switch (type) {
      case 'unpaid-expiry':
        if (booking.status === 'PAYMENT_PENDING' || booking.status === 'CREATED') {
          await transition(bookingId, 'CANCELLED_SYSTEM', { kind: 'system' }, { reason: 'payment not completed' });
        }
        break;
      case 'scheduled-dispatch':
        if (booking.status === 'SEARCHING') await dispatchBooking(bookingId);
        break;
      case 'overrun-safety-ping':
        if (booking.status === 'IN_PROGRESS') {
          await raiseSystemSos(bookingId, 'Job running past booked duration + grace');
        }
        break;
      case 'auto-complete':
        if (booking.status === 'IN_PROGRESS') {
          await transition(bookingId, 'COMPLETED', { kind: 'system' }, { reason: 'auto-complete after timer + grace' });
          await settleCompletion(bookingId);
        }
        break;
    }
  }, { connection });
}
