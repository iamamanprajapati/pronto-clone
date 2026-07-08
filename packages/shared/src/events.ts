import type { BookingStatus } from './booking';
import type { DutyStatus } from './constants';

/** Socket.io channel (room) naming — join via `subscribe` message. */
export const channels = {
  zoneWorkers: (zoneId: string) => `zone:${zoneId}:workers`,
  booking: (bookingId: string) => `booking:${bookingId}`,
  workerJobs: (workerId: string) => `worker:${workerId}:jobs`,
  adminFirehose: (cityId: string) => `admin:${cityId}:firehose`,
} as const;

/** Server → client event names. */
export const EV = {
  ZONE_SNAPSHOT: 'zone.snapshot',
  BOOKING_UPDATE: 'booking.update',
  WORKER_LOCATION: 'booking.worker_location',
  JOB_OFFER: 'job.offer',
  JOB_OFFER_WITHDRAWN: 'job.offer_withdrawn',
  ADMIN_EVENT: 'admin.event',
  SOS_ALERT: 'sos.alert',
} as const;

export interface ZoneSnapshot {
  zoneId: string;
  workers: Array<{
    /** Only present on the admin variant. */
    workerId?: string;
    name?: string;
    lat: number;
    lng: number;
    duty: DutyStatus;
    skills: string[];
  }>;
  counts: { idle: number; enRoute: number; onJob: number };
  bestEtaMin: number | null;
  at: string;
}

export interface BookingUpdate {
  bookingId: string;
  status: BookingStatus;
  worker?: { id: string; name: string; rating: number; photoUrl: string | null; jobsDone: number } | null;
  etaMin?: number | null;
  timerEndsAt?: string | null;
  meta?: Record<string, unknown>;
}

export interface JobOffer {
  offerId: string;
  bookingId: string;
  tasks: string[];
  durationMin: number;
  payoutPaise: number;
  distanceM: number;
  address: { landmark: string | null; lat: number; lng: number };
  customerFirstName: string;
  customerRating: number | null;
  expiresAt: string;
}
