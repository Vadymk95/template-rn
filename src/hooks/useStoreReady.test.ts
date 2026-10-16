import { act, renderHook } from '@testing-library/react-native';

import { useStoreReady } from '@/hooks/useStoreReady';
import { useUserStore } from '@/store/user/userStore';

const setHydrated = async (value: boolean): Promise<void> => {
    await act(() => {
        useUserStore.getState().setHasHydrated(value);
    });
};

describe('useStoreReady', () => {
    it('follows the hydration flag of the user store, in both directions', async () => {
        const { result } = await renderHook(() => useStoreReady());

        await setHydrated(false);
        expect(result.current).toBe(false);

        await setHydrated(true);
        expect(result.current).toBe(true);

        await setHydrated(false);
        expect(result.current).toBe(false);
    });
});
