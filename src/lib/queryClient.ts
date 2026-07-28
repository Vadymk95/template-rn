import { focusManager, QueryClient } from '@tanstack/react-query';
import { type ReactElement, useEffect } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

// Wire React Native AppState into TanStack Query — native apps do not emit
// `window focus` events. Without this, queries never refetch after foregrounding.
// The subscription lives in QueryClientAppStateBridge (mounted from the app shell)
// so the listener is not registered at module import time and cleans up on unmount.

// ─── When you add real server calls, extend this file with: ───────────────────
//
// 1. OFFLINE-FIRST (mobile networks are unreliable):
//    Add `networkMode: 'offlineFirst'` to defaultOptions.queries and wire
//    `onlineManager` via @react-native-community/netinfo:
//
//      import NetInfo from '@react-native-community/netinfo';
//      import { onlineManager } from '@tanstack/react-query';
//      onlineManager.setEventListener((setOnline) =>
//        NetInfo.addEventListener((state) => setOnline(!!state.isConnected))
//      );
//
// 2. QUERY KEY FACTORY per feature (prefix-based invalidation):
//    Create `src/features/<name>/api/<name>Keys.ts` — e.g.:
//
//      export const userKeys = {
//        all: ['users'] as const,
//        detail: (id: string) => [...userKeys.all, 'detail', id] as const,
//      };
//
//    Pair with queryOptions() for type-safe getQueryData without generics.
//
// 3. PERSIST CACHE (optional, offline reads):
//    Use persistQueryClient() with a shouldDehydrateQuery whitelist —
//    persist only "important" queries (profile, settings), never search
//    results or infinite lists (stale data bugs).
//
// 4. RULE: server state → TanStack Query. client/UI state → Zustand.
//    Never put API response data into a Zustand store.
// ─────────────────────────────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const STALE_MINUTES = 1;
const GC_MINUTES = 5;

// A 4xx is the server telling us the request itself is wrong; retrying sends the
// same wrong request again. 5xx and transport failures are the retryable class.
const HTTP_CLIENT_ERROR_FLOOR = 400;
const HTTP_SERVER_ERROR_FLOOR = 500;

const getErrorStatus = (error: unknown): number | undefined => {
    if (error !== null && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: unknown }).status;
        return typeof status === 'number' ? status : undefined;
    }
    return undefined;
};

export const QueryClientAppStateBridge = (): ReactElement | null => {
    useEffect(() => {
        const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
            if (Platform.OS !== 'web') {
                focusManager.setFocused(status === 'active');
            }
        });
        return () => {
            sub.remove();
        };
    }, []);
    return null;
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_MINUTES * MINUTE_MS,
            gcTime: GC_MINUTES * MINUTE_MS,
            retry: (failureCount, error) => {
                const status = getErrorStatus(error);
                if (
                    status !== undefined &&
                    status >= HTTP_CLIENT_ERROR_FLOOR &&
                    status < HTTP_SERVER_ERROR_FLOOR
                ) {
                    return false;
                }
                return failureCount < 2;
            },
            refetchOnWindowFocus: true
        }
    }
});
