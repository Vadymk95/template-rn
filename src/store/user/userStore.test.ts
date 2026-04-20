import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useStoreReady } from '@/hooks/useStoreReady';
import { USER_PERSIST_STORAGE_KEY } from '@/store/user/constants';
import { useUserStore } from '@/store/user/userStore';

describe('useUserStore', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await act(async () => {
            await useUserStore.getState().logout();
        });
    });

    it('setUser persists username and stores token in secure storage', async () => {
        const { result } = renderHook(() => useUserStore());
        await act(async () => {
            await result.current.setUser({ username: 'alice', token: 'tok' });
        });
        expect(result.current.username).toBe('alice');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok');
    });

    it('logout clears username and secure token', async () => {
        const { result } = renderHook(() => useUserStore());
        await act(async () => {
            await result.current.setUser({ username: 'alice', token: 'tok' });
        });
        await act(async () => {
            await result.current.logout();
        });
        expect(result.current.username).toBeNull();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });

    it('persisted AsyncStorage payload never includes the auth token (partialize)', async () => {
        const { result } = renderHook(() => useUserStore());
        await act(async () => {
            await result.current.setUser({ username: 'bob', token: 'super-secret' });
        });
        const raw = await AsyncStorage.getItem(USER_PERSIST_STORAGE_KEY);
        expect(raw).toBeTruthy();
        expect(raw).not.toContain('super-secret');
        if (!raw) {
            throw new Error('expected persisted state');
        }
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        expect(parsed.state).toBeDefined();
        expect(parsed.state).not.toHaveProperty('token');
        expect(parsed.state).not.toHaveProperty('_hasHydrated');
    });

    it('setHasHydrated drives useStoreReady for root layout gating', () => {
        const { result } = renderHook(() => ({
            ready: useStoreReady(),
            hydrated: useUserStore.use._hasHydrated()
        }));

        act(() => {
            useUserStore.getState().setHasHydrated(false);
        });
        expect(result.current.ready).toBe(false);
        expect(result.current.hydrated).toBe(false);

        act(() => {
            useUserStore.getState().setHasHydrated(true);
        });
        expect(result.current.ready).toBe(true);
        expect(result.current.hydrated).toBe(true);
    });

    it('logout clears username but does not reset hydration (avoids splash flash)', async () => {
        act(() => {
            useUserStore.getState().setHasHydrated(true);
        });
        const { result } = renderHook(() => useUserStore());
        await act(async () => {
            await result.current.setUser({ username: 'alice', token: 'tok' });
        });
        await act(async () => {
            await result.current.logout();
        });
        expect(result.current.username).toBeNull();
        expect(useUserStore.getState()._hasHydrated).toBe(true);
    });
});
