import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF' | null;

interface User {
  id: string;
  phoneNumber: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setRole: (role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      role: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, role: user.role, isAuthenticated: true }),
      setRole: (role) => set({ role }),
      logout: () => set({ token: null, user: null, role: null, isAuthenticated: false }),
    }),
    { name: 'triq-auth' }
  )
);
