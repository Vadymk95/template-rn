import { fireEvent, render } from '@testing-library/react-native';

import { getTodoActionLabel, TODO_COPY_KEYS } from '@/features/todo/constants';
import { mockTodos } from '@/store/todo/mockTodos';
import type { Todo } from '@/store/todo/types';
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

    it('calls onToggleTodo when the toggle is pressed', () => {
        const onToggleTodo = jest.fn();
        const { getByTestId } = render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={onToggleTodo}
                onDeleteTodo={jest.fn()}
            />
        );

        fireEvent.press(getByTestId(`todo-toggle-${activeTodo.id}`));
        expect(onToggleTodo).toHaveBeenCalledWith(activeTodo.id);
    });

    it('calls onDeleteTodo when delete is pressed', () => {
        const onDeleteTodo = jest.fn();
        const { getByLabelText } = render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={onDeleteTodo}
            />
        );

        fireEvent.press(
            getByLabelText(
                getTodoActionLabel(activeTodo.title, `todo:${TODO_COPY_KEYS.actions.delete}`)
            )
        );
        expect(onDeleteTodo).toHaveBeenCalledWith(activeTodo.id);
    });

    it('calls onEditTodo with the todo when edit is pressed', () => {
        const onEditTodo = jest.fn();
        const { getByLabelText } = render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={onEditTodo}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        fireEvent.press(
            getByLabelText(
                getTodoActionLabel(activeTodo.title, `todo:${TODO_COPY_KEYS.actions.edit}`)
            )
        );
        expect(onEditTodo).toHaveBeenCalledWith(activeTodo);
    });

    it('applies strikethrough styling to the title when completed', () => {
        const { getByText } = render(
            <TodoListItem
                todo={completedTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        const title = getByText(completedTodo.title);
        expect(title.props.className).toContain('line-through');
        expect(getByText('todo:status.completed')).toBeTruthy();
    });

    it('shows active status copy for incomplete todos', () => {
        const { getByText } = render(
            <TodoListItem
                todo={activeTodo}
                onEditTodo={jest.fn()}
                onToggleTodo={jest.fn()}
                onDeleteTodo={jest.fn()}
            />
        );

        expect(getByText('todo:status.active')).toBeTruthy();
    });
});
