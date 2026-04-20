import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import type { TodoItemModel } from '@/features/todo/types';
import { SPACING_TOKENS } from '@/shared/lib/theme/tokens';
import { SectionHeader } from '@/shared/ui/SectionHeader/SectionHeader';
import { TodoEmptyState } from '@/widgets/todo-workspace/TodoEmptyState';
import { TodoListItem } from '@/widgets/todo-workspace/TodoListItem';

interface TodoListProps {
    todos: TodoItemModel[];
    isFiltered: boolean;
    onCreateTodo: () => void;
    onEditTodo: (todo: TodoItemModel) => void;
    onToggleTodo: (id: string) => void;
    onDeleteTodo: (id: string) => void;
}

export const TodoList = ({
    todos,
    isFiltered,
    onCreateTodo,
    onEditTodo,
    onToggleTodo,
    onDeleteTodo
}: TodoListProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <View style={{ gap: SPACING_TOKENS.md }}>
            <SectionHeader title={t(TODO_COPY_KEYS.list.sectionTitle)} />
            {todos.length === 0 ? (
                <TodoEmptyState isFiltered={isFiltered} onCreateTodo={onCreateTodo} />
            ) : (
                <View style={{ gap: SPACING_TOKENS.md }}>
                    {todos.map((todo) => (
                        <TodoListItem
                            key={todo.id}
                            todo={todo}
                            onEditTodo={onEditTodo}
                            onToggleTodo={onToggleTodo}
                            onDeleteTodo={onDeleteTodo}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};
