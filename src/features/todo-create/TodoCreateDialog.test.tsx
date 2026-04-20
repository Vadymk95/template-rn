import { fireEvent, render } from '@testing-library/react-native';

import { TodoCreateDialog } from '@/features/todo-create/TodoCreateDialog';

jest.mock('@/shared/ui/Dialog/Dialog', () => ({
    // Keep children mounted so the test verifies the form resets itself.
    Dialog: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => {
        const ReactNative = require('react-native');

        return (
            <ReactNative.View>
                <ReactNative.Text>{visible ? 'dialog-open' : 'dialog-closed'}</ReactNative.Text>
                {children}
            </ReactNative.View>
        );
    }
}));

describe('TodoCreateDialog', () => {
    it('resets draft and validation state when the dialog closes and reopens', () => {
        const onClose = jest.fn();
        const onCreateTodo = jest.fn();
        const {
            getByPlaceholderText,
            getByRole,
            getByText,
            queryByDisplayValue,
            queryByText,
            rerender
        } = render(<TodoCreateDialog visible onClose={onClose} onCreateTodo={onCreateTodo} />);

        fireEvent.press(getByRole('button', { name: 'todo:actions.createSubmit' }));
        expect(getByText('todo:form.titleRequired')).toBeTruthy();

        fireEvent.changeText(getByPlaceholderText('todo:form.titlePlaceholder'), 'Draft task');

        rerender(
            <TodoCreateDialog visible={false} onClose={onClose} onCreateTodo={onCreateTodo} />
        );
        rerender(<TodoCreateDialog visible onClose={onClose} onCreateTodo={onCreateTodo} />);

        expect(queryByText('todo:form.titleRequired')).toBeNull();
        expect(queryByDisplayValue('Draft task')).toBeNull();
        expect(getByPlaceholderText('todo:form.titlePlaceholder').props.value).toBe('');
    });
});
