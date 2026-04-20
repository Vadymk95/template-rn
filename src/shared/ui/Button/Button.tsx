import { useColorScheme } from 'nativewind';
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
    CONTROL_SIZE_TOKENS,
    getThemeColorValue,
    INTERACTION_STATE_TOKENS,
    RADII_TOKENS,
    SPACING_TOKENS,
    TYPOGRAPHY_TOKENS,
    type ControlSize
} from '@/shared/lib/theme/tokens';

export const BUTTON_VARIANTS = {
    primary: 'primary',
    secondary: 'secondary',
    ghost: 'ghost',
    destructive: 'destructive'
} as const;

type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
    label?: string;
    children?: ReactNode;
    variant?: ButtonVariant;
    size?: ControlSize;
    fullWidth?: boolean;
    loading?: boolean;
    leftSlot?: ReactNode;
    rightSlot?: ReactNode;
}

const BUTTON_CONTAINER_CLASS_NAMES: Record<ButtonVariant, string> = {
    primary: 'bg-primary border border-primary',
    secondary: 'bg-muted border border-border',
    ghost: 'bg-transparent border border-border',
    destructive: 'bg-destructive border border-destructive'
};

const BUTTON_LABEL_CLASS_NAMES: Record<ButtonVariant, string> = {
    primary: 'text-primary-foreground',
    secondary: 'text-foreground',
    ghost: 'text-foreground',
    destructive: 'text-primary-foreground'
};

const BUTTON_SPINNER_COLOR_ROLE: Record<ButtonVariant, 'textPrimary' | 'accentForeground'> = {
    primary: 'accentForeground',
    secondary: 'textPrimary',
    ghost: 'textPrimary',
    destructive: 'accentForeground'
};

export const Button = ({
    label,
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled = false,
    leftSlot,
    rightSlot,
    accessibilityLabel,
    onPress,
    ...pressableProps
}: ButtonProps): ReactElement => {
    const { colorScheme } = useColorScheme();
    const isDisabled = disabled === true || loading;
    const controlSize = CONTROL_SIZE_TOKENS[size];

    if (__DEV__ && children && !label && !accessibilityLabel) {
        logger.warn(
            '[Button] Provide `label` or `accessibilityLabel` when rendering custom content.'
        );
    }

    const content = children ?? (
        <View
            className="flex-row items-center justify-center"
            style={{
                gap: controlSize.gap
            }}
        >
            {leftSlot ? <View>{leftSlot}</View> : null}
            {label ? (
                <Text className={cn(TYPOGRAPHY_TOKENS.button, BUTTON_LABEL_CLASS_NAMES[variant])}>
                    {label}
                </Text>
            ) : null}
            {rightSlot ? <View>{rightSlot}</View> : null}
        </View>
    );

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{
                disabled: isDisabled,
                busy: loading
            }}
            disabled={isDisabled}
            {...pressableProps}
            onPress={isDisabled ? undefined : onPress}
            className={cn(fullWidth ? 'w-full' : 'self-start')}
            style={({ pressed }) => ({
                opacity: isDisabled
                    ? INTERACTION_STATE_TOKENS.disabledOpacity
                    : pressed
                      ? INTERACTION_STATE_TOKENS.pressedOpacity
                      : 1
            })}
        >
            <View
                className={cn(
                    'flex-row items-center justify-center',
                    BUTTON_CONTAINER_CLASS_NAMES[variant],
                    fullWidth ? 'w-full' : undefined
                )}
                style={{
                    minHeight: controlSize.height,
                    paddingHorizontal: controlSize.paddingHorizontal,
                    borderRadius: RADII_TOKENS.lg
                }}
            >
                {loading ? (
                    <ActivityIndicator
                        color={getThemeColorValue(colorScheme, BUTTON_SPINNER_COLOR_ROLE[variant])}
                        size="small"
                    />
                ) : (
                    <View
                        className="flex-row items-center justify-center"
                        style={{
                            gap: SPACING_TOKENS.sm
                        }}
                    >
                        {content}
                    </View>
                )}
            </View>
        </Pressable>
    );
};
