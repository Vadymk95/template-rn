import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { ComponentProps, ReactElement } from 'react';
import { Text, View } from 'react-native';

import { getThemeColorValue, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Button } from '@/shared/ui/Button/Button';
import { Card } from '@/shared/ui/Card/Card';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    onActionPress?: () => void;
    icon?: IoniconName;
}

export const EmptyState = ({
    title,
    description,
    actionLabel,
    onActionPress,
    icon = 'file-tray-outline'
}: EmptyStateProps): ReactElement => {
    const { colorScheme } = useColorScheme();

    return (
        <Card muted className="items-center" style={{ gap: SPACING_TOKENS.md }}>
            <View className="items-center" style={{ gap: SPACING_TOKENS.md }}>
                <Ionicons
                    name={icon}
                    size={24}
                    color={getThemeColorValue(colorScheme, 'textSecondary')}
                />
                <View className="items-center" style={{ gap: SPACING_TOKENS.xs }}>
                    <Text className={TYPOGRAPHY_TOKENS.sectionTitle}>{title}</Text>
                    <Text className="text-center text-sm text-muted-foreground">{description}</Text>
                </View>
            </View>
            {actionLabel && onActionPress ? (
                <Button label={actionLabel} variant="secondary" onPress={onActionPress} />
            ) : null}
        </Card>
    );
};
