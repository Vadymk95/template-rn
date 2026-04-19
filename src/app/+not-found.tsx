import type { ReactElement } from 'react';

import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { HREF } from '@/shared/lib/constants/routes';

const NotFoundScreen = (): ReactElement => {
    const { t } = useTranslation('notFound');

    return (
        <>
            <Stack.Screen options={{ title: t('stackTitle') }} />
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-xl font-bold text-foreground">{t('body')}</Text>
                <Link href={HREF.home} className="mt-4 text-primary">
                    <Text>{t('link')}</Text>
                </Link>
            </View>
        </>
    );
};

export default NotFoundScreen;
