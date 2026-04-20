import { useColorScheme } from 'nativewind';
import { forwardRef, type ReactElement, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';
import {
    CONTROL_SIZE_TOKENS,
    getThemeColorValue,
    RADII_TOKENS,
    SPACING_TOKENS,
    TYPOGRAPHY_TOKENS
} from '@/shared/lib/theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    hint?: string;
    error?: string;
    leadingAccessory?: ReactNode;
    trailingAccessory?: ReactNode;
    containerClassName?: string;
    inputClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
    (
        {
            label,
            hint,
            error,
            leadingAccessory,
            trailingAccessory,
            containerClassName,
            inputClassName,
            accessibilityLabel,
            accessibilityHint,
            accessibilityState,
            editable,
            ...textInputProps
        },
        ref
    ): ReactElement => {
        const { colorScheme } = useColorScheme();
        const helperText = error ?? hint;
        const hasError = Boolean(error);

        return (
            <View style={{ gap: SPACING_TOKENS.sm }}>
                {label ? <Text className={TYPOGRAPHY_TOKENS.label}>{label}</Text> : null}
                <View
                    className={cn(
                        'flex-row items-center bg-background',
                        hasError ? 'border-destructive' : 'border-border',
                        'border',
                        containerClassName
                    )}
                    style={{
                        minHeight: CONTROL_SIZE_TOKENS.md.height,
                        borderRadius: RADII_TOKENS.lg,
                        paddingHorizontal: SPACING_TOKENS.md,
                        gap: SPACING_TOKENS.sm
                    }}
                >
                    {leadingAccessory ? <View>{leadingAccessory}</View> : null}
                    <TextInput
                        ref={ref}
                        aria-invalid={hasError}
                        accessibilityLabel={accessibilityLabel ?? label}
                        accessibilityHint={accessibilityHint ?? helperText}
                        accessibilityState={{
                            ...accessibilityState,
                            disabled: accessibilityState?.disabled ?? editable === false
                        }}
                        className={cn('flex-1 text-base text-foreground', inputClassName)}
                        editable={editable}
                        placeholderTextColor={getThemeColorValue(colorScheme, 'textSecondary')}
                        {...textInputProps}
                    />
                    {trailingAccessory ? <View>{trailingAccessory}</View> : null}
                </View>
                {helperText ? (
                    <Text
                        accessibilityLiveRegion={hasError ? 'polite' : undefined}
                        className={cn(
                            TYPOGRAPHY_TOKENS.caption,
                            hasError ? 'text-destructive' : 'text-muted-foreground'
                        )}
                    >
                        {helperText}
                    </Text>
                ) : null}
            </View>
        );
    }
);

Input.displayName = 'Input';
