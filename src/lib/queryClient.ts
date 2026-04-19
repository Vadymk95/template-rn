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

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 2,
            refetchOnWindowFocus: true
        }
    }
});
