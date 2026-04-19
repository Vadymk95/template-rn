import { focusManager, QueryClient } from '@tanstack/react-query';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

// Wire React Native AppState into TanStack Query — native apps do not emit
// `window focus` events. Without this, queries never refetch after foregrounding.
AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
    }
});

const getErrorStatus = (error: unknown): number | undefined => {
    if (error !== null && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: unknown }).status;
        return typeof status === 'number' ? status : undefined;
    }
    return undefined;
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
                const status = getErrorStatus(error);
                if (status !== undefined && status >= 400 && status < 500) {
                    return false;
                }
                return failureCount < 2;
            },
            refetchOnWindowFocus: true
        }
    }
});
