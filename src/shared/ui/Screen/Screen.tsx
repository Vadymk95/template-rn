import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';
import { SPACING_TOKENS } from '@/shared/lib/theme/tokens';

interface ScreenProps {
    children: ReactNode;
    scrollable?: boolean;
    className?: string;
    contentClassName?: string;
    contentContainerStyle?: StyleProp<ViewStyle>;
}

export const Screen = ({
    children,
    scrollable = false,
    className,
    contentClassName,
    contentContainerStyle
}: ScreenProps): ReactElement => {
    const insets = useSafeAreaInsets();
    const baseContentStyle: ViewStyle = {
        paddingTop: insets.top + SPACING_TOKENS.lg,
        paddingBottom: insets.bottom + SPACING_TOKENS['2xl'],
        paddingHorizontal: SPACING_TOKENS.lg,
        gap: SPACING_TOKENS.lg,
        flexGrow: 1
    };

    if (scrollable) {
        return (
            <ScrollView
                className={cn('flex-1 bg-background', className)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View
                    className={cn(contentClassName)}
                    style={[baseContentStyle, contentContainerStyle]}
                >
                    {children}
                </View>
            </ScrollView>
        );
    }

    return (
        <View
            className={cn('flex-1 bg-background', className)}
            style={[baseContentStyle, contentContainerStyle]}
        >
            <View className={cn(contentClassName)} style={{ gap: SPACING_TOKENS.lg }}>
                {children}
            </View>
        </View>
    );
};
