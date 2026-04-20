import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_ALL_FILTER_ID, TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import type { TodoItemModel } from '@/features/todo/types';
import { useTodoWorkspace } from '@/features/todo/useTodoWorkspace';
import { TodoCreateDialog } from '@/features/todo-create/TodoCreateDialog';
import { TodoEditDialog } from '@/features/todo-edit/TodoEditDialog';
import { TodoFilterBar } from '@/features/todo-filter/TodoFilterBar';
import { Screen } from '@/shared/ui/Screen/Screen';
import { ScreenHeader } from '@/shared/ui/ScreenHeader/ScreenHeader';
import { TodoList } from '@/widgets/todo-workspace/TodoList';
import { TodoSummaryCards } from '@/widgets/todo-workspace/TodoSummaryCards';

export const TodoWorkspaceScreen = (): ReactElement => {
    const { t: tHome } = useTranslation('home');
    const { t } = useTranslation(TODO_NAMESPACE);
    const {
        visibleTodos,
        filter,
        summary,
        createTodo,
        updateTodo,
        toggleTodo,
        deleteTodo,
        setFilter
    } = useTodoWorkspace();
    const [isCreateDialogVisible, setIsCreateDialogVisible] = useState(false);
    const [editingTodo, setEditingTodo] = useState<TodoItemModel | null>(null);

    return (
        <Screen scrollable>
            <ScreenHeader
                title={tHome('title')}
                subtitle={tHome('subtitle')}
                actionLabel={t(TODO_COPY_KEYS.actions.create)}
                onActionPress={() => {
                    setIsCreateDialogVisible(true);
                }}
            />
            <TodoSummaryCards
                total={summary.total}
                active={summary.active}
                completed={summary.completed}
            />
            <TodoFilterBar selectedFilter={filter} onSelectFilter={setFilter} />
            <TodoList
                todos={visibleTodos}
                isFiltered={filter !== TODO_ALL_FILTER_ID}
                onCreateTodo={() => {
                    setIsCreateDialogVisible(true);
                }}
                onEditTodo={setEditingTodo}
                onToggleTodo={toggleTodo}
                onDeleteTodo={deleteTodo}
            />
            <TodoCreateDialog
                visible={isCreateDialogVisible}
                onClose={() => {
                    setIsCreateDialogVisible(false);
                }}
                onCreateTodo={createTodo}
            />
            <TodoEditDialog
                todo={editingTodo}
                onClose={() => {
                    setEditingTodo(null);
                }}
                onSaveTodo={updateTodo}
            />
        </Screen>
    );
};
