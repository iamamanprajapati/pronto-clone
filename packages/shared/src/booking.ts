/** The single source of truth for booking lifecycle across all surfaces. */
export const BOOKING_STATUSES = [
  'CREATED',
  'PAYMENT_PENDING',
  'SEARCHING',
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'RATED',
  'NO_EXPERT_FOUND',
  'CANCELLED_CUSTOMER',
  'CANCELLED_WORKER',
  'CANCELLED_ADMIN',
  'CANCELLED_SYSTEM',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const CANCELLABLE: BookingStatus[] = [
  'CREATED', 'PAYMENT_PENDING', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED',
];

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CREATED: ['PAYMENT_PENDING', 'SEARCHING', 'CANCELLED_CUSTOMER', 'CANCELLED_SYSTEM'],
  PAYMENT_PENDING: ['SEARCHING', 'CANCELLED_CUSTOMER', 'CANCELLED_SYSTEM'],
  SEARCHING: ['ASSIGNED', 'NO_EXPERT_FOUND', 'CANCELLED_CUSTOMER', 'CANCELLED_ADMIN', 'CANCELLED_SYSTEM'],
  ASSIGNED: ['EN_ROUTE', 'SEARCHING', 'CANCELLED_CUSTOMER', 'CANCELLED_WORKER', 'CANCELLED_ADMIN'],
  EN_ROUTE: ['ARRIVED', 'SEARCHING', 'CANCELLED_CUSTOMER', 'CANCELLED_WORKER', 'CANCELLED_ADMIN'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED_CUSTOMER', 'CANCELLED_WORKER', 'CANCELLED_ADMIN'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED_ADMIN'],
  COMPLETED: ['RATED'],
  RATED: [],
  NO_EXPERT_FOUND: ['SEARCHING'],
  CANCELLED_CUSTOMER: [],
  CANCELLED_WORKER: [],
  CANCELLED_ADMIN: [],
  CANCELLED_SYSTEM: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCancellable(status: BookingStatus): boolean {
  return CANCELLABLE.includes(status);
}

export function isTerminal(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

export const ACTIVE_STATUSES: BookingStatus[] = [
  'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
];

export type BookingActor =
  | { kind: 'system' }
  | { kind: 'customer'; id: string }
  | { kind: 'worker'; id: string }
  | { kind: 'admin'; id: string };
