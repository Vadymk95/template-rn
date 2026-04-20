import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TODO_FILTERS } from '@/store/todo/constants';
import { mockTodos } from '@/store/todo/mockTodos';
import { useTodoStore } from '@/store/todo/todoStore';
import { TodoWorkspaceScreen } from '@/widgets/todo-workspace/TodoWorkspaceScreen';

jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => null
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaConsumer: ({
        children
    }: {
        children: (insets: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        }) => ReactNode;
    }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    })
}));

const cloneTodos = () =>
    mockTodos.map((todo) => ({
        ...todo
    }));

describe('TodoWorkspaceScreen', () => {
    beforeEach(() => {
        useTodoStore.setState({
            todos: cloneTodos(),
            filter: TODO_FILTERS.all
        });
    });

    it('reads the visible workspace heading from the home locale namespace', () => {
        const { getByText } = render(<TodoWorkspaceScreen />);

        expect(getByText('home:title')).toBeTruthy();
        expect(getByText('home:subtitle')).toBeTruthy();
    });

    it('creates a task from the center dialog', () => {
        const { getByPlaceholderText, getByRole, getByText, queryByText } = render(
            <TodoWorkspaceScreen />
        );

        expect(queryByText('Plan MVP analytics')).toBeNull();

        fireEvent.press(getByText('todo:actions.create'));
        fireEvent.changeText(
            getByPlaceholderText('todo:form.titlePlaceholder'),
            'Plan MVP analytics'
        );
        fireEvent.press(getByRole('button', { name: 'todo:actions.createSubmit' }));

        expect(getByText('Plan MVP analytics')).toBeTruthy();
    });

    it('resets the create dialog draft and validation when reopened', () => {
        const { getByPlaceholderText, getByRole, getByText, queryByDisplayValue, queryByText } =
            render(<TodoWorkspaceScreen />);

        fireEvent.press(getByText('todo:actions.create'));
        fireEvent.press(getByRole('button', { name: 'todo:actions.createSubmit' }));
        expect(getByText('todo:form.titleRequired')).toBeTruthy();

        fireEvent.changeText(getByPlaceholderText('todo:form.titlePlaceholder'), 'Draft task');
        fireEvent.press(getByRole('button', { name: 'todo:actions.cancel' }));
        fireEvent.press(getByText('todo:actions.create'));

        expect(queryByText('todo:form.titleRequired')).toBeNull();
        expect(queryByDisplayValue('Draft task')).toBeNull();
        expect(getByPlaceholderText('todo:form.titlePlaceholder').props.value).toBe('');
    });

    it('exposes unique row action labels for each todo', () => {
        const { getByLabelText, queryAllByLabelText } = render(<TodoWorkspaceScreen />);

        expect(getByLabelText('todo:actions.markComplete for Review onboarding copy')).toBeTruthy();
        expect(getByLabelText('todo:actions.delete for Review onboarding copy')).toBeTruthy();
        expect(getByLabelText('todo:actions.edit for Review onboarding copy')).toBeTruthy();
        expect(queryAllByLabelText('todo:actions.markComplete')).toHaveLength(0);
        expect(queryAllByLabelText('todo:actions.delete')).toHaveLength(0);
    });

    it('shows toggled tasks in the completed filter', () => {
        const { getByLabelText, getByRole, getByText, queryByText } = render(
            <TodoWorkspaceScreen />
        );

        expect(queryByText('Review onboarding copy')).toBeTruthy();
        expect(queryByText('Book design review')).toBeTruthy();

        fireEvent.press(getByLabelText('todo:actions.markComplete for Review onboarding copy'));
        fireEvent.press(getByRole('button', { name: 'todo:filters.completed' }));

        expect(getByText('Review onboarding copy')).toBeTruthy();
        expect(getByText('Send sprint summary')).toBeTruthy();
        expect(queryByText('Book design review')).toBeNull();
    });
});
