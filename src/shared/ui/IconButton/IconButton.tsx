import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import type { ComponentProps, ReactElement } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/utils';
import {
    CONTROL_SIZE_TOKENS,
    getThemeColorValue,
    INTERACTION_STATE_TOKENS,
    RADII_TOKENS,
    type ControlSize
} from '@/shared/lib/theme/tokens';

export const ICON_BUTTON_VARIANTS = {
    neutral: 'neutral',
    destructive: 'destructive'
} as const;

type IconButtonVariant = (typeof ICON_BUTTON_VARIANTS)[keyof typeof ICON_BUTTON_VARIANTS];
type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
    icon: IoniconName;
    accessibilityLabel: string;
    variant?: IconButtonVariant;
    size?: ControlSize;
}

const ICON_BUTTON_CLASS_NAMES: Record<IconButtonVariant, string> = {
    neutral: 'bg-muted border border-border',
    destructive: 'bg-destructive/10 border border-destructive'
};

const ICON_COLOR_ROLE: Record<IconButtonVariant, 'textPrimary' | 'danger'> = {
    neutral: 'textPrimary',
    destructive: 'danger'
};

export const IconButton = ({
    icon,
    accessibilityLabel,
    variant = 'neutral',
    size = 'md',
    disabled = false,
    className,
    ...pressableProps
}: IconButtonProps): ReactElement => {
    const { colorScheme } = useColorScheme();
    const controlSize = CONTROL_SIZE_TOKENS[size];
    const isDisabled = Boolean(disabled);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{
                disabled: isDisabled
            }}
            disabled={isDisabled}
            hitSlop={8}
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
                className={cn('items-center justify-center', ICON_BUTTON_CLASS_NAMES[variant])}
                style={{
                    width: controlSize.height,
                    height: controlSize.height,
                    borderRadius: RADII_TOKENS.pill
                }}
            >
                <Ionicons
                    name={icon}
                    size={controlSize.icon}
                    color={getThemeColorValue(colorScheme, ICON_COLOR_ROLE[variant])}
                />
            </View>
        </Pressable>
    );
};
