import type { ReactElement } from 'react';

import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

const HomeScreen = (): ReactElement => {
    const { t } = useTranslation('home');

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>
            <Text className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</Text>
        </View>
    );
};

export default HomeScreen;
