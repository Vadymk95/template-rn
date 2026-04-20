import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TODO_FILTER_OPTIONS, TODO_NAMESPACE } from '@/features/todo/constants';
import { SPACING_TOKENS } from '@/shared/lib/theme/tokens';
import { FilterChip } from '@/shared/ui/FilterChip/FilterChip';
import type { TodoFilter } from '@/store/todo/types';

interface TodoFilterBarProps {
    selectedFilter: TodoFilter;
    onSelectFilter: (filter: TodoFilter) => void;
}

export const TodoFilterBar = ({
    selectedFilter,
    onSelectFilter
}: TodoFilterBarProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <View
            className="flex-row flex-wrap"
            style={{
                gap: SPACING_TOKENS.sm
            }}
        >
            {TODO_FILTER_OPTIONS.map((option) => (
                <FilterChip
                    key={option.id}
                    testID={`todo-filter-${option.id}`}
                    label={t(option.labelKey)}
                    selected={option.id === selectedFilter}
                    onPress={() => {
                        onSelectFilter(option.id);
                    }}
                />
            ))}
        </View>
    );
};
