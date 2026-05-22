import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TAB_BAR_ACTIVE_TINT } from '@/shared/lib/constants/navigationTheme';
import { TAB_SCREEN_IONICONS } from '@/shared/lib/constants/tabBarIcons';

interface TabIconProps {
    color: string;
    size: number;
}

const HomeTabIcon = ({ color, size }: TabIconProps): ReactElement => (
    <Ionicons name={TAB_SCREEN_IONICONS.index} color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: TabIconProps): ReactElement => (
    <Ionicons name={TAB_SCREEN_IONICONS.settings} color={color} size={size} />
);

const TabsLayout = (): ReactElement => {
    const { t } = useTranslation('common');

    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: TAB_BAR_ACTIVE_TINT }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.homeTitle'),
                    tabBarIcon: HomeTabIcon
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.settingsTitle'),
                    tabBarIcon: SettingsTabIcon
                }}
            />
        </Tabs>
    );
};

export default TabsLayout;
