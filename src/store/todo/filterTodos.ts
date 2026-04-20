import { TODO_FILTERS } from '@/store/todo/constants';
import type { Todo, TodoFilter } from '@/store/todo/types';

export const filterTodos = (todos: Todo[], filter: TodoFilter): Todo[] => {
    switch (filter) {
        case TODO_FILTERS.active:
            return todos.filter((todo) => !todo.completed);
        case TODO_FILTERS.completed:
            return todos.filter((todo) => todo.completed);
        case TODO_FILTERS.all:
        default:
            return todos;
    }
};
