import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { clearAuthToken, setAuthToken } from '@/lib/secureToken';

import { createSelectors } from '../utils/createSelectors';

import { USER_PERSIST_STORAGE_KEY } from './constants';

interface UserState {
    username: string | null;
    setUser: (payload: { username: string; token: string }) => Promise<void>;
    logout: () => Promise<void>;
}

const useUserStoreBase = create<UserState>()(
    devtools(
        persist(
            (set) => ({
                username: null,
                setUser: async ({ username, token }) => {
                    await setAuthToken(token);
                    set({ username });
                },
                logout: async () => {
                    await clearAuthToken();
                    set({ username: null });
                }
            }),
            {
                name: USER_PERSIST_STORAGE_KEY,
                storage: createJSONStorage(() => AsyncStorage),
                partialize: (state) => ({ username: state.username })
            }
        )
    )
);

export const useUserStore = createSelectors(useUserStoreBase);
