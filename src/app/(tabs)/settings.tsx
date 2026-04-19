import type { ReactElement } from 'react';

import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

const SettingsScreen = (): ReactElement => {
    const { t } = useTranslation('settings');

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Text className="text-xl font-semibold text-foreground">{t('title')}</Text>
        </View>
    );
};

export default SettingsScreen;
