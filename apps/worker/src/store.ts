import { create } from 'zustand';
import type { JobOffer } from '@pronto/shared';

interface WorkerProfile {
  id: string; name: string | null; phone: string; status: string; duty: string;
  rating: number; jobsDone: number; skills: string[]; languages: string[];
  hub: { id: string; name: string; lat: number; lng: number } | null;
  kycStatus: string; strikes: number; bankAccount: string | null; upiId: string | null;
}

interface WorkerState {
  profile: WorkerProfile | null;
  setProfile: (p: WorkerProfile | null) => void;
  offer: JobOffer | null;
  setOffer: (o: JobOffer | null) => void;
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
}

export const useStore = create<WorkerState>(set => ({
  profile: null,
  setProfile: profile => set({ profile }),
  offer: null,
  setOffer: offer => set({ offer }),
  activeJobId: null,
  setActiveJobId: activeJobId => set({ activeJobId }),
}));
