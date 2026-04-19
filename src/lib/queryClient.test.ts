import { queryClient } from '@/lib/queryClient';

describe('queryClient', () => {
    it('exports a configured TanStack Query client', () => {
        expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(60_000);
        expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(5 * 60_000);
        const retry = queryClient.getDefaultOptions().queries?.retry;
        expect(typeof retry).toBe('function');
        const retryFn = retry as (failureCount: number, error: Error) => boolean;
        const clientError = new Error('client') as Error & { status: number };
        clientError.status = 404;
        const serverError = new Error('server') as Error & { status: number };
        serverError.status = 503;
        expect(retryFn(0, clientError)).toBe(false);
        expect(retryFn(0, serverError)).toBe(true);
        expect(retryFn(2, serverError)).toBe(false);
    });

    it('retry skips only 4xx errors with numeric status; unknown shapes still retry until cap', () => {
        const retry = queryClient.getDefaultOptions().queries?.retry;
        const retryFn = retry as (failureCount: number, error: unknown) => boolean;

        const fourTwoTwo = new Error('unprocessable') as Error & { status: number };
        fourTwoTwo.status = 422;
        expect(retryFn(0, fourTwoTwo)).toBe(false);

        const statusNotNumber = new Error('weird') as Error & { status: unknown };
        statusNotNumber.status = '404';
        expect(retryFn(0, statusNotNumber)).toBe(true);

        expect(retryFn(0, new Error('no status'))).toBe(true);
        expect(retryFn(1, new Error('no status'))).toBe(true);
        expect(retryFn(2, new Error('no status'))).toBe(false);
    });
});
