import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { safeFetch, safeFetchQueryFn, SchemaValidationError } from '@/lib/api/safeFetch';
import { queryClient } from '@/lib/queryClient';

const TestSchema = z.object({
    id: z.string(),
    message: z.string()
});

const TEST_URL = 'https://api.example.com/test';

const okResponse = (body: unknown): Response =>
    ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(body)
    }) as unknown as Response;

const errorResponse = (status: number, statusText: string): Response =>
    ({
        ok: false,
        status,
        statusText,
        json: () => Promise.resolve(null)
    }) as unknown as Response;

describe('safeFetch', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('returns parsed data when the response matches the schema', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce(okResponse({ id: '1', message: 'hi' }));

        await expect(safeFetch(TEST_URL, TestSchema)).resolves.toStrictEqual({
            id: '1',
            message: 'hi'
        });
    });

    it('forwards init.signal to fetch so callers can cancel', async () => {
        const fetchMock = jest.fn().mockResolvedValueOnce(okResponse({ id: '1', message: 'hi' }));
        global.fetch = fetchMock;
        const controller = new AbortController();

        await safeFetch(TEST_URL, TestSchema, { signal: controller.signal });

        expect(fetchMock).toHaveBeenCalledWith(TEST_URL, { signal: controller.signal });
    });

    it('throws Error with HTTP status + statusText on non-2xx', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce(errorResponse(500, 'Server Error'));

        await expect(safeFetch(TEST_URL, TestSchema)).rejects.toThrow(
            `HTTP 500 Server Error (${TEST_URL})`
        );
    });

    it('throws an error carrying the numeric status and url on non-2xx', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce(errorResponse(404, 'Not Found'));

        await expect(safeFetch(TEST_URL, TestSchema)).rejects.toMatchObject({
            name: 'HttpError',
            status: 404,
            url: TEST_URL
        });
    });

    it('throws SchemaValidationError with url + issues on shape drift', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce(okResponse({ id: 1, message: 'hi' }));

        const promise = safeFetch(TEST_URL, TestSchema);

        await expect(promise).rejects.toBeInstanceOf(SchemaValidationError);
        await expect(promise).rejects.toMatchObject({
            name: 'SchemaValidationError',
            url: TEST_URL
        });
        await expect(promise).rejects.toThrow(TEST_URL);
        await expect(promise).rejects.toHaveProperty('issues.length', expect.any(Number));
    });
});

describe('safeFetchQueryFn', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('returns a queryFn that calls safeFetch with the query signal', async () => {
        const fetchMock = jest.fn().mockResolvedValueOnce(okResponse({ id: '1', message: 'hi' }));
        global.fetch = fetchMock;
        const controller = new AbortController();
        const queryFn = safeFetchQueryFn(TEST_URL, TestSchema);

        const result = await queryFn({
            signal: controller.signal,
            queryKey: ['test'],
            meta: undefined,
            client: {} as never
        });

        expect(result).toStrictEqual({ id: '1', message: 'hi' });
        expect(fetchMock).toHaveBeenCalledWith(TEST_URL, { signal: controller.signal });
    });

    it('re-throws AbortError unchanged so TanStack Query treats it as cancellation', async () => {
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        global.fetch = jest.fn().mockRejectedValueOnce(abort);
        const queryFn = safeFetchQueryFn(TEST_URL, TestSchema);

        await expect(
            queryFn({
                signal: new AbortController().signal,
                queryKey: ['test'],
                meta: undefined,
                client: {} as never
            })
        ).rejects.toBe(abort);
    });

    it('re-throws SchemaValidationError so callers see boundary drift', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce(okResponse({ wrong: 'shape' }));
        const queryFn = safeFetchQueryFn(TEST_URL, TestSchema);

        await expect(
            queryFn({
                signal: new AbortController().signal,
                queryKey: ['test'],
                meta: undefined,
                client: {} as never
            })
        ).rejects.toBeInstanceOf(SchemaValidationError);
    });
});

describe('safeFetchQueryFn through the default retry rule', () => {
    const originalFetch = global.fetch;

    // The app's own default `retry` predicate, with the backoff delay zeroed so the
    // 5xx case does not wait; nothing else differs from `queryClient`.
    let client: QueryClient;

    beforeEach(() => {
        client = new QueryClient({
            defaultOptions: {
                queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 }
            }
        });
    });

    afterEach(() => {
        // Drops the query's 5-minute gc timer, which would hold the jest process open.
        client.clear();
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('does not retry a 404: the request is wrong and repeating it cannot help', async () => {
        const fetchMock = jest.fn().mockResolvedValue(errorResponse(404, 'Not Found'));
        global.fetch = fetchMock;

        await expect(
            client.query({
                queryKey: ['not-found'],
                queryFn: safeFetchQueryFn(TEST_URL, TestSchema)
            })
        ).rejects.toThrow(`HTTP 404 Not Found (${TEST_URL})`);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('still retries a 503 up to the default cap of two retries', async () => {
        const fetchMock = jest.fn().mockResolvedValue(errorResponse(503, 'Service Unavailable'));
        global.fetch = fetchMock;

        await expect(
            client.query({
                queryKey: ['unavailable'],
                queryFn: safeFetchQueryFn(TEST_URL, TestSchema)
            })
        ).rejects.toThrow(`HTTP 503 Service Unavailable (${TEST_URL})`);

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
