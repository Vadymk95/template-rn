import '../../global.css';

import { type ReactElement, useEffect, useState } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/queryClient';
import { EXPO_ROUTER } from '@/shared/lib/constants/expoRouter';
import i18n, { i18nInitPromise } from '@/shared/lib/i18n';
import { I18nInitErrorFallback } from '@/shared/lib/i18n/I18nInitErrorFallback';

import { RootStack } from './RootStack';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
    initialRouteName: EXPO_ROUTER.rootStackInitialRoute
};

const RootLayout = (): ReactElement => {
    const [isI18nReady, setIsI18nReady] = useState(i18n.isInitialized);
    const [i18nInitError, setI18nInitError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        void i18nInitPromise
            .then(() => {
                if (!cancelled) {
                    setIsI18nReady(true);
                }
                return undefined;
            })
            .catch((error: unknown) => {
                if (cancelled) {
                    return;
                }
                logger.error('[i18n] Failed to initialize i18next', {
                    reason: error instanceof Error ? error.message : String(error)
                });
                setI18nInitError(error instanceof Error ? error : new Error(String(error)));
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                {i18nInitError ? (
                    <I18nInitErrorFallback />
                ) : !isI18nReady ? (
                    <View className="flex-1 items-center justify-center bg-background">
                        <ActivityIndicator />
                    </View>
                ) : (
                    <I18nextProvider i18n={i18n}>
                        <QueryClientProvider client={queryClient}>
                            <StatusBar style="auto" />
                            <RootStack />
                        </QueryClientProvider>
                    </I18nextProvider>
                )}
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

export default RootLayout;
