import type { ReactElement } from 'react';
import { DevSettings, Pressable, Text, View } from 'react-native';

import { logger } from '@/lib/logger';
import { I18N_INIT_FALLBACK_COPY } from '@/shared/lib/constants/initFallbackCopy';

/**
 * Shown when i18next fails before bundles load. Do not use `t()` here — i18n may be broken.
 * Copy lives in `initFallbackCopy.ts` (not JSON catalogs).
 */
export const I18nInitErrorFallback = (): ReactElement => (
    <View
        className="flex-1 items-center justify-center bg-background px-6"
        accessibilityRole="alert"
    >
        <Text className="text-center text-2xl font-bold text-foreground">
            {I18N_INIT_FALLBACK_COPY.title}
        </Text>
        <Text className="mt-3 text-center text-muted-foreground">
            {I18N_INIT_FALLBACK_COPY.body}
        </Text>
        <Pressable
            className="mt-6 rounded-md bg-primary px-4 py-3 active:opacity-80"
            onPress={() => {
                if (__DEV__) {
                    DevSettings.reload();
                    return;
                }
                logger.warn('[i18n] User acknowledged init failure from fallback UI');
            }}
        >
            <Text className="font-medium text-primary-foreground">
                {__DEV__ ? I18N_INIT_FALLBACK_COPY.reloadDev : I18N_INIT_FALLBACK_COPY.ok}
            </Text>
        </Pressable>
    </View>
);
