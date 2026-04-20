import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TodoEditDialog } from '@/features/todo-edit/TodoEditDialog';
import type { Todo } from '@/store/todo/types';

jest.mock('@/shared/ui/Dialog/Dialog', () => ({
    Dialog: ({
        children,
        visible,
        onClose: _onClose
    }: {
        children: ReactNode;
        visible: boolean;
        onClose: () => void;
    }) => {
        const ReactNative = require('react-native');

        return (
            <ReactNative.View>
                <ReactNative.Text>{visible ? 'dialog-open' : 'dialog-closed'}</ReactNative.Text>
                {children}
            </ReactNative.View>
        );
    }
}));

const sampleTodo: Todo = {
    id: 'todo-1713596400000',
    title: 'Review onboarding copy',
    completed: false,
    createdAt: '2024-04-20T08:00:00.000Z',
    updatedAt: '2024-04-20T08:00:00.000Z'
};

describe('TodoEditDialog', () => {
    it('preloads the title field from the todo', () => {
        const { getByDisplayValue } = render(
            <TodoEditDialog todo={sampleTodo} onClose={jest.fn()} onSaveTodo={jest.fn()} />
        );

        expect(getByDisplayValue('Review onboarding copy')).toBeTruthy();
    });

    it('shows validation when submit runs with an empty trimmed title', () => {
        const { getByPlaceholderText, getByRole, getByText } = render(
            <TodoEditDialog todo={sampleTodo} onClose={jest.fn()} onSaveTodo={jest.fn()} />
        );

        fireEvent.changeText(getByPlaceholderText('todo:form.titlePlaceholder'), '   ');
        fireEvent.press(getByRole('button', { name: 'todo:actions.saveSubmit' }));

        expect(getByText('todo:form.titleRequired')).toBeTruthy();
    });

    it('submits a trimmed title, calls onSaveTodo, and closes', () => {
        const onClose = jest.fn();
        const onSaveTodo = jest.fn();
        const { getByPlaceholderText, getByRole } = render(
            <TodoEditDialog todo={sampleTodo} onClose={onClose} onSaveTodo={onSaveTodo} />
        );

        fireEvent.changeText(
            getByPlaceholderText('todo:form.titlePlaceholder'),
            '  Updated title  '
        );
        fireEvent.press(getByRole('button', { name: 'todo:actions.saveSubmit' }));

        expect(onSaveTodo).toHaveBeenCalledWith(sampleTodo.id, 'Updated title');
        expect(onClose).toHaveBeenCalled();
    });

    it('invokes onClose when cancel is pressed', () => {
        const onClose = jest.fn();
        const onSaveTodo = jest.fn();
        const { getByRole } = render(
            <TodoEditDialog todo={sampleTodo} onClose={onClose} onSaveTodo={onSaveTodo} />
        );

        fireEvent.press(getByRole('button', { name: 'todo:actions.cancel' }));

        expect(onClose).toHaveBeenCalled();
        expect(onSaveTodo).not.toHaveBeenCalled();
    });

    it('does not call onSaveTodo when todo is null even if the form submits', () => {
        const onSaveTodo = jest.fn();
        const { getByPlaceholderText, getByRole } = render(
            <TodoEditDialog todo={null} onClose={jest.fn()} onSaveTodo={onSaveTodo} />
        );

        fireEvent.changeText(getByPlaceholderText('todo:form.titlePlaceholder'), 'Ghost title');
        fireEvent.press(getByRole('button', { name: 'todo:actions.saveSubmit' }));

        expect(onSaveTodo).not.toHaveBeenCalled();
    });
});
