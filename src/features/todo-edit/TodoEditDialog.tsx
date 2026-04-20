import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import { TodoForm } from '@/features/todo-create/TodoForm';
import { Dialog } from '@/shared/ui/Dialog/Dialog';
import type { Todo } from '@/store/todo/types';

interface TodoEditDialogProps {
    todo: Todo | null;
    onClose: () => void;
    onSaveTodo: (id: string, title: string) => void;
}

export const TodoEditDialog = ({
    todo,
    onClose,
    onSaveTodo
}: TodoEditDialogProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <Dialog
            visible={todo !== null}
            title={t(TODO_COPY_KEYS.dialogs.editTitle)}
            description={t(TODO_COPY_KEYS.dialogs.editDescription)}
            onClose={onClose}
        >
            <TodoForm
                initialTitle={todo?.title ?? ''}
                submitLabel={t(TODO_COPY_KEYS.actions.saveSubmit)}
                onCancel={onClose}
                onSubmit={(title) => {
                    if (!todo) {
                        return;
                    }

                    onSaveTodo(todo.id, title);
                    onClose();
                }}
            />
        </Dialog>
    );
};
