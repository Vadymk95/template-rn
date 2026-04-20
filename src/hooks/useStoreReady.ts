import { useUserStore } from '@/store/user/userStore';

/**
 * Returns true once all persisted Zustand stores have finished rehydrating from
 * AsyncStorage. Gates the root layout so the app tree never renders against
 * stale defaults from the first synchronous render.
 */
export const useStoreReady = (): boolean => useUserStore.use._hasHydrated();
