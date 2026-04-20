import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { DEFAULT_TODO_FILTER } from '@/store/todo/constants';
import { createTodoId } from '@/store/todo/createTodoId';
import { mockTodos } from '@/store/todo/mockTodos';
import type { Todo, TodoState } from '@/store/todo/types';
import { createSelectors } from '@/store/utils/createSelectors';

const cloneTodo = (todo: Todo): Todo => ({
    ...todo
});

const normalizeTitle = (title: string): string => title.trim();

const getNextTodoCollisionIndex = (todos: Todo[], timestamp: number): number => {
    const baseId = createTodoId(timestamp);
    const suffixPrefix = `${baseId}-`;

    const maxCollisionIndex = todos.reduce((maxIndex, todo) => {
        if (todo.id === baseId) {
            return Math.max(maxIndex, 0);
        }

        if (!todo.id.startsWith(suffixPrefix)) {
            return maxIndex;
        }

        const suffixValue = Number.parseInt(todo.id.slice(suffixPrefix.length), 10);
        if (Number.isNaN(suffixValue)) {
            return maxIndex;
        }

        return Math.max(maxIndex, suffixValue);
    }, -1);

    return maxCollisionIndex + 1;
};

const useTodoStoreBase = create<TodoState>()(
    devtools((set) => ({
        todos: mockTodos.map(cloneTodo),
        filter: DEFAULT_TODO_FILTER,
        createTodo: (title) => {
            set((state) => {
                const normalizedTitle = normalizeTitle(title);
                if (!normalizedTitle) {
                    return state;
                }

                const timestamp = Date.now();
                const createdAt = new Date(timestamp).toISOString();
                const collisionIndex = getNextTodoCollisionIndex(state.todos, timestamp);

                return {
                    todos: [
                        {
                            id: createTodoId(timestamp, collisionIndex),
                            title: normalizedTitle,
                            completed: false,
                            createdAt,
                            updatedAt: createdAt
                        },
                        ...state.todos
                    ]
                };
            });
        },
        updateTodo: (id, title) => {
            set((state) => {
                const normalizedTitle = normalizeTitle(title);
                if (!normalizedTitle) {
                    return state;
                }

                const updatedAt = new Date().toISOString();

                return {
                    todos: state.todos.map((todo) =>
                        todo.id === id
                            ? {
                                  ...todo,
                                  title: normalizedTitle,
                                  updatedAt
                              }
                            : todo
                    )
                };
            });
        },
        toggleTodo: (id) => {
            set((state) => {
                const updatedAt = new Date().toISOString();

                return {
                    todos: state.todos.map((todo) =>
                        todo.id === id
                            ? {
                                  ...todo,
                                  completed: !todo.completed,
                                  updatedAt
                              }
                            : todo
                    )
                };
            });
        },
        deleteTodo: (id) => {
            set((state) => ({
                todos: state.todos.filter((todo) => todo.id !== id)
            }));
        },
        setFilter: (filter) => {
            set(() => ({
                filter
            }));
        }
    }))
);

export const useTodoStore = createSelectors(useTodoStoreBase);
