import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Button } from '@/shared/ui/Button/Button';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onActionPress?: () => void;
}

export const ScreenHeader = ({
    title,
    subtitle,
    actionLabel,
    onActionPress
}: ScreenHeaderProps): ReactElement => (
    <View
        className="flex-row items-center justify-between"
        style={{
            gap: SPACING_TOKENS.md
        }}
    >
        <View
            className="flex-1"
            style={{
                gap: SPACING_TOKENS.sm
            }}
        >
            <Text className={TYPOGRAPHY_TOKENS.screenTitle}>{title}</Text>
            {subtitle ? <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onActionPress ? (
            <Button label={actionLabel} onPress={onActionPress} size="sm" />
        ) : null}
    </View>
);
