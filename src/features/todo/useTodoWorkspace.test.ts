import { act, renderHook } from '@testing-library/react-native';

import { useTodoWorkspace } from '@/features/todo/useTodoWorkspace';
import { TODO_FILTERS } from '@/store/todo/constants';
import { filterTodos } from '@/store/todo/filterTodos';
import { mockTodos } from '@/store/todo/mockTodos';
import { useTodoStore } from '@/store/todo/todoStore';

const cloneTodos = () =>
    mockTodos.map((todo) => ({
        ...todo
    }));

describe('useTodoWorkspace', () => {
    beforeEach(() => {
        useTodoStore.setState({
            todos: cloneTodos(),
            filter: TODO_FILTERS.all
        });
    });

    it('returns visible todos, summary counts, and store actions from the todo store', async () => {
        const todos = cloneTodos();
        const completed = todos.filter((todo) => todo.completed).length;
        const { result } = await renderHook(() => useTodoWorkspace());

        expect(result.current.visibleTodos).toEqual(filterTodos(todos, TODO_FILTERS.all));
        expect(result.current.summary).toEqual({
            total: todos.length,
            active: todos.length - completed,
            completed
        });
        expect(result.current.filter).toBe(TODO_FILTERS.all);
        expect(typeof result.current.createTodo).toBe('function');
        expect(typeof result.current.setFilter).toBe('function');
    });

    it('updates visibleTodos when the filter changes', async () => {
        const { result } = await renderHook(() => useTodoWorkspace());

        expect(result.current.visibleTodos).toEqual(filterTodos(cloneTodos(), TODO_FILTERS.all));

        await act(() => {
            result.current.setFilter(TODO_FILTERS.completed);
        });

        expect(result.current.visibleTodos).toEqual(
            filterTodos(cloneTodos(), TODO_FILTERS.completed)
        );
        expect(result.current.filter).toBe(TODO_FILTERS.completed);
    });
});
