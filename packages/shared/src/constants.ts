export const DURATION_BLOCKS_MIN = [60, 90, 120, 180, 240] as const;
export type DurationBlock = (typeof DURATION_BLOCKS_MIN)[number];

export const OFFER_TTL_SECONDS = 20;
export const MAX_OFFER_ROUNDS = 3;
export const DISPATCH_RADIUS_M = 2000;

/** Free cancellation window before scheduled start. */
export const FREE_CANCEL_MINUTES = 30;
export const LATE_CANCEL_FEE_PAISE = 5000; // ₹50

export const EXTENSION_BLOCKS_MIN = [30, 60] as const;

/** Location ping cadence (seconds) by worker state. */
export const PING_INTERVAL = { EN_ROUTE: 10, IDLE: 30 } as const;
export const WORKER_LIVENESS_TTL_S = 90;
export const SNAPSHOT_INTERVAL_MS = 5000;
/** Grid size for anonymizing worker positions sent to customers. */
export const ANON_GRID_DEG = 0.0015; // ~150m

export const UNPAID_BOOKING_EXPIRY_MIN = 10;
export const JOB_OVERRUN_SAFETY_PING_MIN = 15;
export const AUTO_COMPLETE_GRACE_MIN = 10;

export const ARRIVAL_GEOFENCE_M = 150;
export const HUB_CHECKIN_GEOFENCE_M = 300;

export const TIP_PRESETS_PAISE = [2000, 3000, 5000] as const;

export const WORKER_STATUSES = ['NEW', 'UNDER_REVIEW', 'TRAINING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const DUTY_STATUSES = ['OFF_DUTY', 'IDLE', 'OFFERED', 'EN_ROUTE', 'ON_JOB'] as const;
export type DutyStatus = (typeof DUTY_STATUSES)[number];

export const ADMIN_ROLES = ['SUPER_ADMIN', 'CITY_OPS', 'HUB_SUPERVISOR', 'SUPPORT', 'FINANCE', 'VERIFIER'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
