import { renderHook } from '@testing-library/react-native';
import { create } from 'zustand';

import { createSelectors } from '@/store/utils/createSelectors';

describe('createSelectors', () => {
    it('adds use.<key>() hooks for each state field', () => {
        const useStore = createSelectors(
            create<{ count: number; bump: () => void }>(() => ({
                count: 0,
                bump: jest.fn()
            }))
        );
        const { result } = renderHook(() => useStore.use.count());
        expect(result.current).toBe(0);
    });
});
