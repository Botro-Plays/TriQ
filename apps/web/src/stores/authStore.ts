import { create } from 'zustand';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF' | null;

interface AuthState {
  role: UserRole;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  isAuthenticated: false,
  setRole: (role) => set({ role, isAuthenticated: !!role }),
  logout: () => set({ role: null, isAuthenticated: false }),
}));
