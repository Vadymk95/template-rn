import type { ReactElement } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

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
            {...(className ? { className } : {})}
            style={({ pressed }) => ({
                opacity: isDisabled
                    ? INTERACTION_STATE_TOKENS.disabledOpacity
                    : pressed
                      ? INTERACTION_STATE_TOKENS.pressedOpacity
                      : 1
            })}
            {...pressableProps}
        >
            <View
                className={cn(
                    'flex-row items-center justify-center border',
                    selected ? 'border-primary bg-primary' : 'border-border bg-background'
                )}
                style={{
                    minHeight: controlSize.height,
                    borderRadius: RADII_TOKENS.pill,
                    paddingHorizontal: SPACING_TOKENS.md,
                    paddingVertical: SPACING_TOKENS.xs
                }}
            >
                <Text
                    className={cn(
                        TYPOGRAPHY_TOKENS.button,
                        selected ? 'text-primary-foreground' : 'text-foreground'
                    )}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
};
