import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { TAB_SCREEN_IONICONS } from '@/shared/lib/constants/tabBarIcons';
import { getThemeColorValue } from '@/shared/lib/theme/colors';

interface TabIconProps {
    color: ColorValue;
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
    // React Navigation needs a real colour value, not a NativeWind class, so the
    // tint is read from the token table per scheme. A fixed value here made the
    // active tab near-invisible in dark mode: near-black on a near-black bar.
    const { colorScheme } = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: getThemeColorValue(colorScheme, 'textPrimary')
            }}
        >
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
