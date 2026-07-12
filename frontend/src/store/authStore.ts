import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  fetchMe: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const { data } = await api.get<User>('/users/me');
          set({ user: data, isLoading: false });
        } catch {
          set({ user: null, isLoading: false });
        }
      },
      clearAuth: () => {
        set({ user: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      },
    }),
    {
      name: 'pandahub-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
