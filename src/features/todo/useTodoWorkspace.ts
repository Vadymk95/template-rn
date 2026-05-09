import { useShallow } from 'zustand/react/shallow';

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

// React Compiler 1.0 (enabled via `experiments.reactCompiler: true` in
// `app.config.ts`) auto-memoises pure derivations on each render, so the
// previous manual `useMemo` wrappers around `filterTodos(todos, filter)` and
// the summary object were redundant. Per CLAUDE.md: "Skip manual useMemo /
// useCallback / React.memo unless you hit a specific regression. Opt a file
// out with `'use no memo'` at the top." No regression observed; manual
// memoisation removed. `useShallow` from zustand still drives store-level
// reference stability for the destructured slice.
export const useTodoWorkspace = (): TodoWorkspaceState => {
    const { todos, filter, createTodo, updateTodo, toggleTodo, deleteTodo, setFilter } =
        useTodoStore(
            useShallow((state) => ({
                todos: state.todos,
                filter: state.filter,
                createTodo: state.createTodo,
                updateTodo: state.updateTodo,
                toggleTodo: state.toggleTodo,
                deleteTodo: state.deleteTodo,
                setFilter: state.setFilter
            }))
        );

    const visibleTodos = filterTodos(todos, filter);
    const completed = todos.filter((todo) => todo.completed).length;
    const summary: TodoSummary = {
        total: todos.length,
        active: todos.length - completed,
        completed
    };

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
