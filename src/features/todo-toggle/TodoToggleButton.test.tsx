import { fireEvent, render } from '@testing-library/react-native';

import { getTodoActionLabel, TODO_COPY_KEYS } from '@/features/todo/constants';
import { TodoToggleButton } from '@/features/todo-toggle/TodoToggleButton';
import { expectAccessibleControl } from '@/test/a11y';
import { renderOnWeb, tagAttributes } from '@/test/webDom';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

const loadTodoToggleButton = () =>
    require('@/features/todo-toggle/TodoToggleButton').TodoToggleButton;

const TITLE = 'Review onboarding copy';
const MARK_COMPLETE = getTodoActionLabel(TITLE, `todo:${TODO_COPY_KEYS.actions.markComplete}`);
const MARK_ACTIVE = getTodoActionLabel(TITLE, `todo:${TODO_COPY_KEYS.actions.markActive}`);

describe('TodoToggleButton', () => {
    it('exposes a button role and the action it performs on this task', async () => {
        await expectAccessibleControl(
            <TodoToggleButton completed={false} todoTitle={TITLE} onPress={jest.fn()} />,
            { role: 'button', name: MARK_COMPLETE }
        );
    });

    it('calls onPress when pressed', async () => {
        const onPress = jest.fn();
        const { getByRole } = await render(
            <TodoToggleButton completed={false} todoTitle={TITLE} onPress={onPress} />
        );

        await fireEvent.press(getByRole('button', { name: MARK_COMPLETE }));

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('announces a completed task as selected, and drops it again when reopened', async () => {
        const { getByRole, queryByRole, rerender } = await render(
            <TodoToggleButton completed={false} todoTitle={TITLE} onPress={jest.fn()} />
        );

        expect(queryByRole('button', { selected: true })).toBeNull();

        await rerender(<TodoToggleButton completed todoTitle={TITLE} onPress={jest.fn()} />);
        expect(getByRole('button', { name: MARK_ACTIVE, selected: true })).toBeTruthy();

        await rerender(
            <TodoToggleButton completed={false} todoTitle={TITLE} onPress={jest.fn()} />
        );
        expect(queryByRole('button', { selected: true })).toBeNull();
    });

    // react-native-web maps `aria-*` props to the DOM and ignores `accessibilityState`, so the
    // completed state only reaches a browser (and its screen reader) as `aria-selected`.
    it('puts the completed state on the DOM node as aria-selected on web', () => {
        const props = { todoTitle: TITLE, onPress: jest.fn() };

        const completed = tagAttributes(
            renderOnWeb(loadTodoToggleButton, { ...props, completed: true })
        );
        const active = tagAttributes(
            renderOnWeb(loadTodoToggleButton, { ...props, completed: false })
        );

        expect(completed).toMatchObject({ 'aria-label': MARK_ACTIVE, 'aria-selected': 'true' });
        expect(active).toMatchObject({ 'aria-label': MARK_COMPLETE, 'aria-selected': 'false' });
    });
});
