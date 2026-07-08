import { db } from '../db';
import { config } from '../config';

/**
 * Notification fan-out. Provider "log" stores in DB + console (dev).
 * Swap in FCM/MSG91/Gupshup senders here for production — the call sites don't change.
 */
export async function notify(
  userId: string | null,
  channel: 'push' | 'sms' | 'whatsapp',
  title: string,
  body: string,
  phone?: string,
) {
  if (userId) {
    await db.notification.create({ data: { userId, channel, title, body } });
  }
  if (config.notifyProvider === 'log') {
    console.log(`[notify:${channel}] ${phone ?? userId}: ${title} — ${body}`);
    return;
  }
  // production: FCM data message / MSG91 SMS / WhatsApp template send goes here
}

/** Booking-status → customer notification templates. */
export const bookingTemplates: Record<string, (meta: { workerName?: string }) => { title: string; body: string } | null> = {
  ASSIGNED: m => ({ title: 'Expert assigned! 🎉', body: `${m.workerName ?? 'Your expert'} is getting ready.` }),
  EN_ROUTE: m => ({ title: 'Expert on the way', body: `${m.workerName ?? 'Your expert'} is heading to you.` }),
  ARRIVED: () => ({ title: 'Expert at your door', body: 'Share the OTP in the app to start.' }),
  IN_PROGRESS: () => ({ title: 'Service started', body: 'Your service timer has begun.' }),
  COMPLETED: () => ({ title: 'Service complete ✅', body: 'Rate your experience and tip if you liked it.' }),
  NO_EXPERT_FOUND: () => ({ title: 'No experts available', body: 'Try scheduling for a later slot.' }),
  CANCELLED_WORKER: () => ({ title: 'Booking needs attention', body: 'Your expert had to cancel. We are reassigning.' }),
};
