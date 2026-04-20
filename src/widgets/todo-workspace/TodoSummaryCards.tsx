import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Card } from '@/shared/ui/Card/Card';

interface TodoSummaryCardsProps {
    total: number;
    active: number;
    completed: number;
}

export const TodoSummaryCards = ({
    total,
    active,
    completed
}: TodoSummaryCardsProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);
    const items = [
        {
            label: t(TODO_COPY_KEYS.summary.total),
            value: total
        },
        {
            label: t(TODO_COPY_KEYS.summary.active),
            value: active
        },
        {
            label: t(TODO_COPY_KEYS.summary.completed),
            value: completed
        }
    ] as const;

    return (
        <View
            className="flex-row flex-wrap"
            style={{
                gap: SPACING_TOKENS.md
            }}
        >
            {items.map((item) => (
                <Card
                    key={item.label}
                    className="flex-1"
                    style={{
                        minWidth: 96,
                        gap: SPACING_TOKENS.xs
                    }}
                >
                    <Text className={TYPOGRAPHY_TOKENS.caption}>{item.label}</Text>
                    <Text className={TYPOGRAPHY_TOKENS.sectionTitle}>{item.value}</Text>
                </Card>
            ))}
        </View>
    );
};
