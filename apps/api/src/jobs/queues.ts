import { Queue } from 'bullmq';
import { config } from '../config';

const connection = { url: config.redisUrl };

/** Offer TTL enforcement. */
export const offerTimeoutQueue = new Queue('offer-timeout', { connection });
/** Booking timers: unpaid expiry, scheduled dispatch, auto-complete, overrun safety ping. */
export const bookingTimersQueue = new Queue('booking-timers', { connection });
