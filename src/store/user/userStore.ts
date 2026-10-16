import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { clearAuthToken, setAuthToken } from '@/lib/secureToken';
import { STORAGE_KEYS } from '@/lib/storageKeys';

interface UserState {
    username: string | null;
    _hasHydrated: boolean;
    setUser: (payload: { username: string; token: string }) => Promise<void>;
    logout: () => Promise<void>;
    setHasHydrated: (value: boolean) => void;
}

export const useUserStore = create<UserState>()(
    devtools(
        persist(
            (set) => ({
                username: null,
                _hasHydrated: false,
                setUser: async ({ username, token }) => {
                    await setAuthToken(token);
                    set({ username });
                },
                logout: async () => {
                    await clearAuthToken();
                    set({ username: null });
                },
                setHasHydrated: (value) => set({ _hasHydrated: value })
            }),
            {
                name: STORAGE_KEYS.userPersist,
                storage: createJSONStorage(() => AsyncStorage),
                partialize: (state) => ({ username: state.username }),
                onRehydrateStorage: () => (state) => {
                    state?.setHasHydrated(true);
                }
            }
        )
    )
);
