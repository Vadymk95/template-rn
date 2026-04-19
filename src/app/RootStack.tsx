import type { ReactElement } from 'react';

import { Stack } from 'expo-router';

import { EXPO_ROUTER } from '@/shared/lib/constants/expoRouter';

export const RootStack = (): ReactElement => (
    <Stack>
        <Stack.Screen name={EXPO_ROUTER.rootTabGroup} options={{ headerShown: false }} />
    </Stack>
);
