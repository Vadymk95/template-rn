import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_COPY_KEYS, TODO_NAMESPACE, getTodoActionLabel } from '@/features/todo/constants';
import { IconButton } from '@/shared/ui/IconButton/IconButton';

interface TodoDeleteButtonProps {
    todoTitle: string;
    onPress: () => void;
}

export const TodoDeleteButton = ({ todoTitle, onPress }: TodoDeleteButtonProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <IconButton
            icon="trash-outline"
            variant="destructive"
            accessibilityLabel={getTodoActionLabel(todoTitle, t(TODO_COPY_KEYS.actions.delete))}
            onPress={onPress}
        />
    );
};
