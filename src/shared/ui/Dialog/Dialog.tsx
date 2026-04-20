import { useColorScheme } from 'nativewind';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { getThemeColorValue, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Card } from '@/shared/ui/Card/Card';
import { IconButton } from '@/shared/ui/IconButton/IconButton';

interface DialogProps {
    visible: boolean;
    title: string;
    description?: string;
    children: ReactNode;
    onClose: () => void;
    footer?: ReactNode;
}

export const Dialog = ({
    visible,
    title,
    description,
    children,
    onClose,
    footer
}: DialogProps): ReactElement => {
    const { colorScheme } = useColorScheme();
    const { t } = useTranslation('common');

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                className="flex-1 justify-center px-4"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{
                    backgroundColor: getThemeColorValue(colorScheme, 'backdrop')
                }}
            >
                <Pressable
                    className="absolute inset-0"
                    accessible={false}
                    importantForAccessibility="no"
                    onPress={onClose}
                />
                <View accessibilityViewIsModal style={{ gap: SPACING_TOKENS.md }}>
                    <Card style={{ gap: SPACING_TOKENS.lg }}>
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
                                    <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>
                                        {description}
                                    </Text>
                                ) : null}
                            </View>
                            <IconButton
                                icon="close"
                                size="sm"
                                accessibilityLabel={t('button.close')}
                                onPress={onClose}
                            />
                        </View>
                        <View style={{ gap: SPACING_TOKENS.md }}>{children}</View>
                        {footer ? <View style={{ gap: SPACING_TOKENS.sm }}>{footer}</View> : null}
                    </Card>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
