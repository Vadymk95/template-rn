import type { ReactElement } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/utils';
import {
    CONTROL_SIZE_TOKENS,
    INTERACTION_STATE_TOKENS,
    RADII_TOKENS,
    SPACING_TOKENS,
    TYPOGRAPHY_TOKENS
} from '@/shared/lib/theme/tokens';

interface FilterChipProps extends Omit<PressableProps, 'children' | 'style'> {
    label: string;
    selected?: boolean;
}

export const FilterChip = ({
    label,
    selected = false,
    disabled = false,
    className,
    ...pressableProps
}: FilterChipProps): ReactElement => {
    const controlSize = CONTROL_SIZE_TOKENS.sm;
    const isDisabled = Boolean(disabled);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{
                disabled: isDisabled,
                selected
            }}
            disabled={isDisabled}
            className={cn(
                'items-center justify-center border',
                selected ? 'border-primary bg-primary' : 'border-border bg-muted',
                className
            )}
            style={({ pressed }) => ({
                minHeight: controlSize.height,
                borderRadius: RADII_TOKENS.pill,
                paddingHorizontal: SPACING_TOKENS.md,
                opacity: isDisabled
                    ? INTERACTION_STATE_TOKENS.disabledOpacity
                    : pressed
                      ? INTERACTION_STATE_TOKENS.pressedOpacity
                      : 1
            })}
            {...pressableProps}
        >
            <Text
                className={cn(
                    TYPOGRAPHY_TOKENS.button,
                    selected ? 'text-primary-foreground' : 'text-foreground'
                )}
            >
                {label}
            </Text>
        </Pressable>
    );
};
