import { create } from 'zustand';

interface User { id: string; phone: string; name: string | null; email: string | null }
interface Address { id: string; tag: string; lat: number; lng: number; flat: string; landmark: string | null }
interface Zone { id: string; name: string; cityId: string; cityName: string }
interface Service { id: string; slug: string; name: string; category: string; icon: string; baseMinutes: number }

interface AppState {
  user: User | null;
  setUser: (u: User | null) => void;

  zone: Zone | null;
  setZone: (z: Zone | null) => void;

  addresses: Address[];
  setAddresses: (a: Address[]) => void;
  selectedAddress: Address | null;
  setSelectedAddress: (a: Address | null) => void;

  services: Service[];
  setServices: (s: Service[]) => void;

  // booking draft (the 3-step sheet)
  draftTasks: string[];
  toggleTask: (slug: string) => void;
  draftDuration: number;
  setDraftDuration: (m: number) => void;
  draftScheduledAt: string | null;
  setDraftScheduledAt: (s: string | null) => void;
  clearDraft: () => void;

  activeBookingId: string | null;
  setActiveBookingId: (id: string | null) => void;
}

export const useStore = create<AppState>(set => ({
  user: null,
  setUser: user => set({ user }),
  zone: null,
  setZone: zone => set({ zone }),
  addresses: [],
  setAddresses: addresses => set({ addresses }),
  selectedAddress: null,
  setSelectedAddress: selectedAddress => set({ selectedAddress }),
  services: [],
  setServices: services => set({ services }),
  draftTasks: [],
  toggleTask: slug =>
    set(s => ({
      draftTasks: s.draftTasks.includes(slug) ? s.draftTasks.filter(t => t !== slug) : [...s.draftTasks, slug],
    })),
  draftDuration: 60,
  setDraftDuration: draftDuration => set({ draftDuration }),
  draftScheduledAt: null,
  setDraftScheduledAt: draftScheduledAt => set({ draftScheduledAt }),
  clearDraft: () => set({ draftTasks: [], draftDuration: 60, draftScheduledAt: null }),
  activeBookingId: null,
  setActiveBookingId: activeBookingId => set({ activeBookingId }),
}));
