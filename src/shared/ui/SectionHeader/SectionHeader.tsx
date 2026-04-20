import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Button } from '@/shared/ui/Button/Button';

interface SectionHeaderProps {
    title: string;
    description?: string;
    actionLabel?: string;
    onActionPress?: () => void;
}

export const SectionHeader = ({
    title,
    description,
    actionLabel,
    onActionPress
}: SectionHeaderProps): ReactElement => (
    <View
        className="flex-row items-start justify-between"
        style={{
            gap: SPACING_TOKENS.md
        }}
    >
        <View
            className="flex-1"
            style={{
                gap: SPACING_TOKENS.xs
            }}
        >
            <Text className={TYPOGRAPHY_TOKENS.sectionTitle}>{title}</Text>
            {description ? (
                <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>{description}</Text>
            ) : null}
        </View>
        {actionLabel && onActionPress ? (
            <Button label={actionLabel} variant="ghost" size="sm" onPress={onActionPress} />
        ) : null}
    </View>
);
