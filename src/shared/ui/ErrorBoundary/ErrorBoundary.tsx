import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { logger } from '@/lib/logger';
import { ERROR_BOUNDARY_COPY } from '@/shared/lib/constants/errorBoundaryCopy';

/**
 * Production-safe fallback for render errors surfaced by Expo Router.
 * Re-exported from `src/app/_layout.tsx` to replace the default stack-trace UI.
 * Copy is hardcoded (see `errorBoundaryCopy.ts`) — i18n may be the thing that failed.
 */
export const ErrorBoundary = ({ error, retry }: ErrorBoundaryProps): ReactElement => {
    useEffect(() => {
        logger.error('[ErrorBoundary] Unhandled render error', error, {
            message: error.message
        });
    }, [error]);

    return (
        <View
            className="flex-1 items-center justify-center bg-background px-6"
            accessible
            accessibilityRole="alert"
        >
            <Text className="text-center text-2xl font-bold text-foreground">
                {ERROR_BOUNDARY_COPY.title}
            </Text>
            <Text className="mt-3 text-center text-muted-foreground">
                {ERROR_BOUNDARY_COPY.body}
            </Text>
            <Pressable
                className="mt-6 rounded-md bg-primary px-4 py-3 active:opacity-80"
                onPress={() => {
                    void retry();
                }}
                accessibilityRole="button"
            >
                <Text className="font-medium text-primary-foreground">
                    {ERROR_BOUNDARY_COPY.retry}
                </Text>
            </Pressable>
        </View>
    );
};
