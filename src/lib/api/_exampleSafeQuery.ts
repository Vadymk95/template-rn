/**
 * 🌱 TEMPLATE SEED — do NOT delete during refactors.
 *
 * Why it exists:
 *   Canonical reference for the boundary-validation + TanStack Query pattern
 *   on React Native (Expo). Demonstrates how `safeFetchQueryFn` composes a
 *   Zod schema + URL into a TanStack Query `queryFn` that fails loud on
 *   backend shape drift instead of leaking a bad shape into the screen.
 *
 *   The mobile-distribution-lag rationale lives in
 *   `src/lib/api/safeFetch.ts` JSDoc + `.cursor/brain/DECISIONS.md` ADR
 *   "[2026-05] Boundary validation via Zod safeFetch wrapper (mobile-aware)".
 *
 * What it demonstrates:
 *   - stable query key factory (`exampleKeys`)
 *   - inline Zod schema as the single source of truth for the response type
 *     (`type Example = z.infer<typeof ExampleSchema>`)
 *   - typed `queryOptions()` factory consumed via `useQuery(exampleOptions())`
 *   - `safeFetchQueryFn(url, schema)` wiring (signal + AbortError pass-through
 *     handled by the wrapper itself)
 *   - URL composed via `env.EXPO_PUBLIC_API_URL` (no literal string drift)
 *
 * When to delete:
 *   Only when this template graduates to a real product AND at least one
 *   real `<domain>.queries.ts` module exists that uses the same pattern.
 *
 * Leading underscore signals "reference, not wired into routes / screens".
 */
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/env';
import { safeFetchQueryFn } from '@/lib/api/safeFetch';

const ExampleSchema = z.object({
    id: z.string(),
    message: z.string()
});

export type Example = z.infer<typeof ExampleSchema>;

const EXAMPLE_URL = `${env.EXPO_PUBLIC_API_URL}/example`;

export const exampleKeys = {
    all: ['example'] as const,
    detail: () => [...exampleKeys.all, 'detail'] as const
};

export const exampleOptions = () =>
    queryOptions({
        queryKey: exampleKeys.detail(),
        queryFn: safeFetchQueryFn(EXAMPLE_URL, ExampleSchema),
        staleTime: 60_000
    });
