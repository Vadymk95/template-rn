import { act } from '@testing-library/react-native';

import { TODO_FILTERS } from '@/store/todo/constants';
import { createTodoId } from '@/store/todo/createTodoId';
import { filterTodos } from '@/store/todo/filterTodos';
import { mockTodos } from '@/store/todo/mockTodos';
import { useTodoStore } from '@/store/todo/todoStore';
import type { Todo } from '@/store/todo/types';

const cloneTodos = (): Todo[] =>
    mockTodos.map((todo) => ({
        ...todo
    }));

describe('createTodoId', () => {
    it('builds a stable todo id from a numeric timestamp', () => {
        expect(createTodoId(1713600000000)).toBe('todo-1713600000000');
    });

    it('appends a deterministic suffix when multiple ids share a timestamp', () => {
        expect(createTodoId(1713600000000, 1)).toBe('todo-1713600000000-1');
    });
});

describe('filterTodos', () => {
    it('returns all todos for the all filter', () => {
        expect(filterTodos(mockTodos, TODO_FILTERS.all)).toEqual(mockTodos);
    });

    it('returns only incomplete todos for the active filter', () => {
        expect(filterTodos(mockTodos, TODO_FILTERS.active)).toEqual(
            mockTodos.filter((todo) => !todo.completed)
        );
    });

    it('returns only completed todos for the completed filter', () => {
        expect(filterTodos(mockTodos, TODO_FILTERS.completed)).toEqual(
            mockTodos.filter((todo) => todo.completed)
        );
    });
});

describe('useTodoStore', () => {
    beforeEach(() => {
        useTodoStore.setState({
            todos: cloneTodos(),
            filter: TODO_FILTERS.all
        });
    });

    it('createTodo trims title and prepends a new incomplete task', () => {
        const previousTodos = useTodoStore.getState().todos;

        act(() => {
            useTodoStore.getState().createTodo('  Buy oat milk  ');
        });

        const nextTodos = useTodoStore.getState().todos;
        const createdTodo = nextTodos[0];
        if (!createdTodo) {
            throw new Error('expected created todo');
        }

        expect(nextTodos).toHaveLength(previousTodos.length + 1);
        expect(createdTodo).toMatchObject({
            title: 'Buy oat milk',
            completed: false
        });
        expect(createdTodo.createdAt).toBe(createdTodo.updatedAt);
        expect(nextTodos.slice(1)).toEqual(previousTodos);
    });

    it('createTodo ignores empty or whitespace-only titles', () => {
        const previousTodos = useTodoStore.getState().todos;

        act(() => {
            useTodoStore.getState().createTodo('   ');
        });

        expect(useTodoStore.getState().todos).toEqual(previousTodos);
    });

    it('createTodo generates unique ids when two todos are created in the same millisecond', () => {
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1713607200000);

        act(() => {
            useTodoStore.getState().createTodo('First task');
            useTodoStore.getState().createTodo('Second task');
        });

        const [latestTodo, previousTodo] = useTodoStore.getState().todos;
        if (!latestTodo || !previousTodo) {
            throw new Error('expected created todos');
        }

        expect(latestTodo.id).toBe('todo-1713607200000-1');
        expect(previousTodo.id).toBe('todo-1713607200000');
        expect(latestTodo.id).not.toBe(previousTodo.id);

        nowSpy.mockRestore();
    });

    it('createTodo uses the next available suffix after deleting a same-timestamp todo', () => {
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1713607200000);

        act(() => {
            useTodoStore.getState().createTodo('First task');
            useTodoStore.getState().createTodo('Second task');
        });

        const [, firstCreatedTodo] = useTodoStore.getState().todos;
        if (!firstCreatedTodo) {
            throw new Error('expected first created todo');
        }

        act(() => {
            useTodoStore.getState().deleteTodo(firstCreatedTodo.id);
            useTodoStore.getState().createTodo('Third task');
        });

        const [latestTodo, previousTodo] = useTodoStore.getState().todos;
        if (!latestTodo || !previousTodo) {
            throw new Error('expected created todos after deletion');
        }

        expect(latestTodo.id).toBe('todo-1713607200000-2');
        expect(previousTodo.id).toBe('todo-1713607200000-1');
        expect(latestTodo.id).not.toBe(previousTodo.id);

        nowSpy.mockRestore();
    });

    it('updateTodo updates the trimmed title and updatedAt timestamp', () => {
        const todoToUpdate = useTodoStore.getState().todos[1];
        if (!todoToUpdate) {
            throw new Error('expected todo to update');
        }

        act(() => {
            useTodoStore.getState().updateTodo(todoToUpdate.id, '  Send release notes  ');
        });

        const updatedTodo = useTodoStore
            .getState()
            .todos.find((todo) => todo.id === todoToUpdate.id);

        expect(updatedTodo?.title).toBe('Send release notes');
        expect(updatedTodo?.createdAt).toBe(todoToUpdate.createdAt);
        expect(updatedTodo?.completed).toBe(todoToUpdate.completed);
        expect(updatedTodo?.updatedAt).not.toBe(todoToUpdate.updatedAt);
    });

    it('updateTodo ignores empty or whitespace-only titles', () => {
        const todoToUpdate = useTodoStore.getState().todos[1];
        if (!todoToUpdate) {
            throw new Error('expected todo to update');
        }

        act(() => {
            useTodoStore.getState().updateTodo(todoToUpdate.id, '   ');
        });

        const unchangedTodo = useTodoStore
            .getState()
            .todos.find((todo) => todo.id === todoToUpdate.id);

        expect(unchangedTodo).toEqual(todoToUpdate);
    });

    it('toggleTodo flips the completed flag and updates updatedAt', () => {
        const todoToToggle = useTodoStore.getState().todos[0];
        if (!todoToToggle) {
            throw new Error('expected todo to toggle');
        }

        act(() => {
            useTodoStore.getState().toggleTodo(todoToToggle.id);
        });

        const toggledTodo = useTodoStore
            .getState()
            .todos.find((todo) => todo.id === todoToToggle.id);

        expect(toggledTodo?.completed).toBe(!todoToToggle.completed);
        expect(toggledTodo?.updatedAt).not.toBe(todoToToggle.updatedAt);
    });

    it('deleteTodo removes a todo by id', () => {
        const todoToDelete = useTodoStore.getState().todos[0];
        if (!todoToDelete) {
            throw new Error('expected todo to delete');
        }

        act(() => {
            useTodoStore.getState().deleteTodo(todoToDelete.id);
        });

        expect(useTodoStore.getState().todos).toHaveLength(mockTodos.length - 1);
        expect(useTodoStore.getState().todos).not.toContainEqual(todoToDelete);
    });

    it('setFilter updates the active filter', () => {
        act(() => {
            useTodoStore.getState().setFilter(TODO_FILTERS.completed);
        });

        expect(useTodoStore.getState().filter).toBe(TODO_FILTERS.completed);
    });
});
