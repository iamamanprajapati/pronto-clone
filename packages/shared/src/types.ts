import type { BookingStatus } from './booking';
import type { AdminRole, DutyStatus, WorkerStatus } from './constants';

export interface UserDTO {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: 'CUSTOMER' | 'WORKER' | 'ADMIN';
}

export interface AddressDTO {
  id: string;
  tag: string;
  lat: number;
  lng: number;
  flat: string;
  landmark: string | null;
}

export interface ServiceDTO {
  id: string;
  name: string;
  category: string;
  icon: string;
  baseMinutes: number;
}

export interface PriceQuote {
  durationMin: number;
  basePaise: number;
  surgeMultiplier: number;
  discountPaise: number;
  totalPaise: number;
  couponCode: string | null;
}

export interface BookingDTO {
  id: string;
  status: BookingStatus;
  tasks: string[];
  taskNames: string[];
  durationMin: number;
  scheduledAt: string | null;
  instructions: string | null;
  address: AddressDTO;
  worker: { id: string; name: string; rating: number; photoUrl: string | null; jobsDone: number } | null;
  otp: string | null;
  pricing: { basePaise: number; extensionPaise: number; discountPaise: number; tipPaise: number; totalPaise: number };
  startedAt: string | null;
  timerEndsAt: string | null;
  createdAt: string;
}

export interface WorkerProfileDTO {
  id: string;
  name: string;
  status: WorkerStatus;
  duty: DutyStatus;
  rating: number;
  jobsDone: number;
  skills: string[];
  hub: { id: string; name: string; lat: number; lng: number } | null;
  kycStatus: string;
}

export interface EarningsSummary {
  todayPaise: number;
  weekPaise: number;
  monthPaise: number;
  jobsToday: number;
  tipsPaise: number;
  incentiveProgress: { target: number; done: number; bonusPaise: number };
}

export interface AdminUserDTO {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  cityId: string | null;
  hubId: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
}
