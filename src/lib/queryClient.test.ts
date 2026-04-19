import { queryClient } from '@/lib/queryClient';

describe('queryClient', () => {
    it('exports a configured TanStack Query client', () => {
        expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(60_000);
        expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(5 * 60_000);
        expect(queryClient.getDefaultOptions().queries?.retry).toBe(2);
    });
});
