import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { clearAuthToken, setAuthToken } from '@/lib/secureToken';
import { USER_PERSIST_STORAGE_KEY } from '@/store/user/constants';
import { createSelectors } from '@/store/utils/createSelectors';

interface UserState {
    username: string | null;
    _hasHydrated: boolean;
    setUser: (payload: { username: string; token: string }) => Promise<void>;
    logout: () => Promise<void>;
    setHasHydrated: (value: boolean) => void;
}

const useUserStoreBase = create<UserState>()(
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
                name: USER_PERSIST_STORAGE_KEY,
                storage: createJSONStorage(() => AsyncStorage),
                partialize: (state) => ({ username: state.username }),
                onRehydrateStorage: () => (state) => {
                    state?.setHasHydrated(true);
                }
            }
        )
    )
);

export const useUserStore = createSelectors(useUserStoreBase);
