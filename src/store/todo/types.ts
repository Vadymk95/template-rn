import type { TODO_FILTERS } from '@/store/todo/constants';

export interface Todo {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

export type TodoFilter = (typeof TODO_FILTERS)[keyof typeof TODO_FILTERS];

export interface TodoState {
    todos: Todo[];
    filter: TodoFilter;
    createTodo: (title: string) => void;
    updateTodo: (id: string, title: string) => void;
    toggleTodo: (id: string) => void;
    deleteTodo: (id: string) => void;
    setFilter: (filter: TodoFilter) => void;
}
