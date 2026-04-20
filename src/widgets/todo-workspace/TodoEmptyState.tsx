import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

interface TodoEmptyStateProps {
    isFiltered: boolean;
    onCreateTodo: () => void;
}

export const TodoEmptyState = ({ isFiltered, onCreateTodo }: TodoEmptyStateProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <EmptyState
            title={
                isFiltered
                    ? t(TODO_COPY_KEYS.list.emptyFilteredTitle)
                    : t(TODO_COPY_KEYS.list.emptyAllTitle)
            }
            description={
                isFiltered
                    ? t(TODO_COPY_KEYS.list.emptyFilteredDescription)
                    : t(TODO_COPY_KEYS.list.emptyAllDescription)
            }
            actionLabel={t(TODO_COPY_KEYS.actions.create)}
            onActionPress={onCreateTodo}
            icon={isFiltered ? 'filter-outline' : 'checkbox-outline'}
        />
    );
};
