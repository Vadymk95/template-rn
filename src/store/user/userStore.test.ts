import { act, renderHook } from '@testing-library/react-native';

import { useUserStore } from '@/store/user/userStore';

describe('useUserStore', () => {
    beforeEach(() => {
        act(() => {
            useUserStore.getState().logout();
        });
    });

    it('setUser updates username and token', () => {
        const { result } = renderHook(() => useUserStore());
        act(() => {
            result.current.setUser({ username: 'alice', token: 'tok' });
        });
        expect(result.current.username).toBe('alice');
        expect(result.current.token).toBe('tok');
    });

    it('logout clears username and token', () => {
        const { result } = renderHook(() => useUserStore());
        act(() => {
            result.current.setUser({ username: 'alice', token: 'tok' });
        });
        act(() => {
            result.current.logout();
        });
        expect(result.current.username).toBeNull();
        expect(result.current.token).toBeNull();
    });
});
