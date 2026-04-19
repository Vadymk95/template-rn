import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { createSelectors } from '../utils/createSelectors';

import { USER_PERSIST_STORAGE_KEY } from './constants';

interface UserState {
    username: string | null;
    token: string | null;
    setUser: (payload: { username: string; token: string }) => void;
    logout: () => void;
}

const useUserStoreBase = create<UserState>()(
    devtools(
        persist(
            (set) => ({
                username: null,
                token: null,
                setUser: ({ username, token }) => set({ username, token }),
                logout: () => set({ username: null, token: null })
            }),
            {
                name: USER_PERSIST_STORAGE_KEY,
                storage: createJSONStorage(() => AsyncStorage),
                // Tokens belong in expo-secure-store; only persist non-sensitive fields.
                partialize: (state) => ({ username: state.username })
            }
        )
    )
);

export const useUserStore = createSelectors(useUserStoreBase);
