import { useMemo } from 'react';

import { filterTodos } from '@/store/todo/filterTodos';
import { useTodoStore } from '@/store/todo/todoStore';
import type { Todo, TodoFilter, TodoState } from '@/store/todo/types';

interface TodoSummary {
    total: number;
    active: number;
    completed: number;
}

interface TodoWorkspaceState {
    todos: Todo[];
    visibleTodos: Todo[];
    filter: TodoFilter;
    summary: TodoSummary;
    createTodo: TodoState['createTodo'];
    updateTodo: TodoState['updateTodo'];
    toggleTodo: TodoState['toggleTodo'];
    deleteTodo: TodoState['deleteTodo'];
    setFilter: TodoState['setFilter'];
}

export const useTodoWorkspace = (): TodoWorkspaceState => {
    const todos = useTodoStore.use.todos();
    const filter = useTodoStore.use.filter();
    const createTodo = useTodoStore.use.createTodo();
    const updateTodo = useTodoStore.use.updateTodo();
    const toggleTodo = useTodoStore.use.toggleTodo();
    const deleteTodo = useTodoStore.use.deleteTodo();
    const setFilter = useTodoStore.use.setFilter();

    const visibleTodos = useMemo(() => filterTodos(todos, filter), [filter, todos]);
    const summary = useMemo<TodoSummary>(() => {
        const completed = todos.filter((todo) => todo.completed).length;
        return {
            total: todos.length,
            active: todos.length - completed,
            completed
        };
    }, [todos]);

    return {
        todos,
        visibleTodos,
        filter,
        summary,
        createTodo,
        updateTodo,
        toggleTodo,
        deleteTodo,
        setFilter
    };
};
