/**
 * Boundary validation wrapper — parses every API response through a Zod schema
 * before it reaches application code.
 *
 * ─── React Native: mobile distribution lag amplifies BE-drift impact ──────
 *
 * Unlike web (deploy + reload = users on new code in minutes), mobile users
 * cannot get a fix instantly:
 *
 *   • App Store review: days-to-weeks of latency between push and user.
 *   • Play Store: faster, but still hours-to-days for staged rollout.
 *   • EAS Update (OTA) reduces the gap to minutes — but only for JS bundle
 *     changes; anything touching native modules still requires a store
 *     submission.
 *
 * Consequence: backend schema drift in production = bug already in user
 * hands BEFORE the patch can reach them. Naive
 * `await fetch(url).then((r) => r.json())` passes the bad shape downstream
 * unchecked — the symptom surfaces as a confusing NaN/blank/crash render
 * deep inside a screen, far from the boundary.
 *
 * `safeFetch` parses on every read so drift fails loud AT the boundary with
 * `SchemaValidationError` carrying the URL + structured Zod issues. Caller
 * has a graceful-degradation surface (catch → "data unavailable" fallback,
 * log via `logger.error`, telemetry breadcrumb) instead of three components
 * deep in NPE country.
 *
 * When to use:
 *   - TanStack Query `queryFn` → `safeFetchQueryFn(url, schema)`
 *   - Direct fetch calls         → `safeFetch(url, schema)`
 *   - AsyncStorage reads         → `Schema.safeParse(JSON.parse(raw))`
 *   - expo-secure-store reads    → same pattern
 *
 * When NOT to use:
 *   - tRPC / GraphQL with codegen (separate pattern owns type safety)
 *   - throwaway prototypes
 *   - internal in-app function calls (no boundary to validate)
 *
 * See `.cursor/brain/DECISIONS.md` ADR
 * "[2026-05] Boundary validation via Zod safeFetch wrapper (mobile-aware)"
 * for the rationale + revisit trigger.
 */
import type { QueryFunction } from '@tanstack/react-query';
import type { z } from 'zod';

/**
 * Thrown when a fetched response fails Zod validation. Carries the URL that
 * produced the bad shape and the structured Zod issue list — useful for
 * logger context, Sentry breadcrumbs (see `src/lib/logger.ts` + the Sentry
 * RN integration ADR), and "show diff" debugging UI in dev builds.
 */
export class SchemaValidationError extends Error {
    // Declared separately: parameter properties are forbidden under
    // `verbatimModuleSyntax` + Expo's strict tsconfig in this template.
    readonly url: string;
    readonly issues: z.core.$ZodIssue[];

    constructor(url: string, issues: z.core.$ZodIssue[]) {
        super(`Schema validation failed for ${url}: ${issues.length.toString()} issue(s)`);
        this.name = 'SchemaValidationError';
        this.url = url;
        this.issues = issues;
    }
}

/**
 * Fetches `url` and validates the JSON response against `schema`.
 *
 * - Throws `Error` on HTTP non-2xx (`HTTP <status> <statusText> (<url>)`).
 * - Throws `SchemaValidationError` if the response body fails `schema.safeParse`.
 * - Forwards `init.signal` to `fetch` so callers can cancel in-flight requests.
 *
 * Generic param `Schema` is inferred from the runtime schema — use
 * `z.infer<typeof Schema>` for the public response type so the runtime check
 * and the static type stay in sync.
 *
 * For TanStack Query usage prefer `safeFetchQueryFn` — it wires the query
 * `signal` and re-throws `AbortError` unchanged so cancellation flows
 * correctly through the query cache.
 *
 * @example
 *   const GreetingSchema = z.object({ greeting: z.string() });
 *   type Greeting = z.infer<typeof GreetingSchema>;
 *   const data: Greeting = await safeFetch('/api/greeting', GreetingSchema);
 */
export const safeFetch = async <Schema extends z.ZodType>(
    url: string,
    schema: Schema,
    init?: RequestInit
): Promise<z.infer<Schema>> => {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status.toString()} ${response.statusText} (${url})`);
    }

    const raw: unknown = await response.json();
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
        throw new SchemaValidationError(url, parsed.error.issues);
    }

    return parsed.data;
};

/**
 * Curried `queryFn` factory for TanStack Query — wires schema validation into
 * `useQuery` / `queryOptions` without repeating the closure shape. Forwards
 * the query `signal` to `fetch` and re-throws `AbortError` unchanged so
 * TanStack Query recognises it as cancellation (not error).
 *
 * @example
 *   const GreetingSchema = z.object({ greeting: z.string() });
 *
 *   export const greetingOptions = () =>
 *       queryOptions({
 *           queryKey: greetingKeys.detail(),
 *           queryFn: safeFetchQueryFn(`${env.EXPO_PUBLIC_API_URL}/greeting`, GreetingSchema),
 *           staleTime: 60_000
 *       });
 */
export const safeFetchQueryFn =
    <Schema extends z.ZodType>(url: string, schema: Schema): QueryFunction<z.infer<Schema>> =>
    async ({ signal }) => {
        try {
            return await safeFetch(url, schema, { signal });
        } catch (error) {
            // AbortError is structured cancellation, not a runtime failure —
            // re-throw unchanged so TanStack Query's cancellation path works.
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            throw error;
        }
    };
