import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';
import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Card } from '@/shared/ui/Card/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader/SectionHeader';
import { START_GUIDE_CODE_CLASS_NAME } from '@/widgets/start-guide/constants';

export interface StartGuideItem {
    id: string;
    /** A path or a command, rendered in monospace above the text. */
    code?: string;
    title?: string;
    text: string;
}

interface StartGuideSectionProps {
    title: string;
    description?: string;
    items: readonly StartGuideItem[];
    footer?: string;
}

export const StartGuideSection = ({
    title,
    description,
    items,
    footer
}: StartGuideSectionProps): ReactElement => (
    <View style={{ gap: SPACING_TOKENS.md }}>
        <SectionHeader title={title} {...(description ? { description } : {})} />
        <Card accessibilityRole="list" style={{ gap: SPACING_TOKENS.md }}>
            {items.map((item, index) => (
                // `accessible` groups a row into one announcement: the code, the title and the text
                // together, instead of three stops per row.
                <View
                    key={item.id}
                    accessible
                    className={cn(index > 0 && 'border-t border-border pt-3')}
                    style={{ gap: SPACING_TOKENS.xs }}
                >
                    {item.code ? (
                        <Text className={START_GUIDE_CODE_CLASS_NAME}>{item.code}</Text>
                    ) : null}
                    {item.title ? (
                        <Text className={TYPOGRAPHY_TOKENS.label}>{item.title}</Text>
                    ) : null}
                    <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>{item.text}</Text>
                </View>
            ))}
        </Card>
        {footer ? <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>{footer}</Text> : null}
    </View>
);
