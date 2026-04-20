import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import { TodoForm } from '@/features/todo-create/TodoForm';
import { Dialog } from '@/shared/ui/Dialog/Dialog';

interface TodoCreateDialogProps {
    visible: boolean;
    onClose: () => void;
    onCreateTodo: (title: string) => void;
}

export const TodoCreateDialog = ({
    visible,
    onClose,
    onCreateTodo
}: TodoCreateDialogProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <Dialog
            visible={visible}
            title={t(TODO_COPY_KEYS.dialogs.createTitle)}
            description={t(TODO_COPY_KEYS.dialogs.createDescription)}
            onClose={onClose}
        >
            <TodoForm
                key={visible ? 'todo-create-form-open' : 'todo-create-form-closed'}
                initialTitle=""
                submitLabel={t(TODO_COPY_KEYS.actions.createSubmit)}
                onCancel={onClose}
                onSubmit={(title) => {
                    onCreateTodo(title);
                    onClose();
                }}
            />
        </Dialog>
    );
};
