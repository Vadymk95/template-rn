import { fireEvent, render } from '@testing-library/react-native';

import { TodoEmptyState } from '@/widgets/todo-workspace/TodoEmptyState';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

describe('TodoEmptyState', () => {
    it('renders the all-empty copy and invokes create on action press', () => {
        const onCreateTodo = jest.fn();
        const { getByText, getByRole } = render(
            <TodoEmptyState isFiltered={false} onCreateTodo={onCreateTodo} />
        );

        expect(getByText('todo:list.emptyAllTitle')).toBeTruthy();
        expect(getByText('todo:list.emptyAllDescription')).toBeTruthy();
        fireEvent.press(getByRole('button', { name: 'todo:actions.create' }));
        expect(onCreateTodo).toHaveBeenCalledTimes(1);
    });

    it('renders the filtered-empty copy when isFiltered is true', () => {
        const onCreateTodo = jest.fn();
        const { getByText, getByRole } = render(
            <TodoEmptyState isFiltered onCreateTodo={onCreateTodo} />
        );

        expect(getByText('todo:list.emptyFilteredTitle')).toBeTruthy();
        expect(getByText('todo:list.emptyFilteredDescription')).toBeTruthy();
        fireEvent.press(getByRole('button', { name: 'todo:actions.create' }));
        expect(onCreateTodo).toHaveBeenCalledTimes(1);
    });
});
