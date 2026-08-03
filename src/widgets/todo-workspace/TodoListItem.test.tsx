import { fireEvent, render } from '@testing-library/react-native';

import { getTodoActionLabel, TODO_COPY_KEYS } from '@/features/todo/constants';
import { mockTodos } from '@/store/todo/mockTodos';
import type { Todo } from '@/store/todo/types';
import { TEXT_STATES, transformText } from '@/test/contentStress';
import { TodoListItem } from '@/widgets/todo-workspace/TodoListItem';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

describe('TodoListItem', () => {
    const first = mockTodos[0];
    const second = mockTodos[1];
    if (first === undefined || second === undefined) {
        throw new Error('mockTodos must include at least two todos');
    }
    const activeTodo: Todo = first;
    const completedTodo: Todo = second;

    it('calls onToggleTodo when the toggle is pressed', async () => {
        const onToggleTodo = jest.fn();
        const { getByTestId } = await render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={onToggleTodo}
                onDeleteTodo={jest.fn()}
            />
        );

        await fireEvent.press(getByTestId(`todo-toggle-${activeTodo.id}`));
        expect(onToggleTodo).toHaveBeenCalledWith(activeTodo.id);
    });

    it('calls onDeleteTodo when delete is pressed', async () => {
        const onDeleteTodo = jest.fn();
        const { getByLabelText } = await render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={onDeleteTodo}
            />
        );

        await fireEvent.press(
            getByLabelText(
                getTodoActionLabel(activeTodo.title, `todo:${TODO_COPY_KEYS.actions.delete}`)
            )
        );
        expect(onDeleteTodo).toHaveBeenCalledWith(activeTodo.id);
    });

    it('calls onEditTodo with the todo when edit is pressed', async () => {
        const onEditTodo = jest.fn();
        const { getByLabelText } = await render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={onEditTodo}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        await fireEvent.press(
            getByLabelText(
                getTodoActionLabel(activeTodo.title, `todo:${TODO_COPY_KEYS.actions.edit}`)
            )
        );
        expect(onEditTodo).toHaveBeenCalledWith(activeTodo);
    });

    it('applies strikethrough styling to the title when completed', async () => {
        const { getByText } = await render(
            <TodoListItem
                todo={completedTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        const title = getByText(completedTodo.title);
        expect(title.props['className']).toContain('line-through');
        expect(getByText('todo:status.completed')).toBeTruthy();
    });

    it('shows active status copy for incomplete todos', async () => {
        const { getByText } = await render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        expect(getByText('todo:status.active')).toBeTruthy();
    });

    /*
     * Content variance, native flavour. RNTL renders to a tree with no layout engine behind it, so these
     * assert the PROPS that bound a layout — a line cap and a shrinking column — and nothing about the
     * resulting pixels. That limit is real: the pixels need a device, and `.maestro/` is where a device
     * run lives. What a test CAN catch is the prop going missing, which is how the bound disappears.
     */
    it.each(TEXT_STATES)('renders a %s title without losing the line cap', async (state) => {
        const todo: Todo = { ...activeTodo, title: transformText(activeTodo.title, state) };
        const { getByText } = await render(
            <TodoListItem
                todo={todo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        const title = getByText(todo.title);

        // Without the cap an unbroken or very long title grows the card without bound and pushes every
        // following row off the screen. Nothing in this app limited title length before.
        expect(title.props['numberOfLines']).toBeGreaterThan(0);
        expect(title.props['ellipsizeMode']).toBe('tail');
    });

    it('lets the text column shrink instead of pushing the row', async () => {
        // A row whose text sibling cannot shrink is the native equivalent of a missing `min-w-0`: the
        // long word wins and the delete control leaves the screen.
        const todo: Todo = { ...activeTodo, title: transformText(activeTodo.title, 'unbroken') };
        const { getByText } = await render(
            <TodoListItem
                todo={todo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        const column = getByText(todo.title).parent;

        expect(String(column?.props['className'] ?? '')).toContain('flex-1');
    });
});
