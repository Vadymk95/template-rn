import { render } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInput } from 'react-native';

import { Input } from '@/shared/ui/Input/Input';
import { expectAccessibleControl, TEXT_FIELD_ROLE } from '@/test/a11y';
import { renderOnWeb, tagAttributes } from '@/test/webDom';

const loadInput = () => require('@/shared/ui/Input/Input').Input;

const HINT_COLOUR = 'text-muted-foreground';
const ERROR_COLOUR = 'text-destructive';

const classesOf = (element: { props: Record<string, unknown> }): string[] =>
    String(element.props['className']).split(/\s+/);

const colourClassesOf = (element: { props: Record<string, unknown> }): string[] =>
    classesOf(element).filter((name) => name === HINT_COLOUR || name === ERROR_COLOUR);

describe('Input', () => {
    it('exposes the text field under its label', async () => {
        await expectAccessibleControl(<Input label="Task title" />, {
            role: TEXT_FIELD_ROLE,
            name: 'Task title'
        });
    });

    it('forwards its ref to the underlying text input', async () => {
        const inputRef = createRef<TextInput>();

        await render(<Input ref={inputRef} label="Task title" />);

        expect(inputRef.current).toBeTruthy();
    });

    it('marks the input invalid and exposes the error as an accessibility hint', async () => {
        const { getByLabelText, getByText } = await render(
            <Input label="Task title" error="Title is required" />
        );

        const input = getByLabelText('Task title');

        expect(getByText('Title is required')).toBeTruthy();
        expect(input.props['aria-disabled']).toBe(false);
        expect(input.props['aria-invalid']).toBe(true);
        expect(input.props['accessibilityHint']).toBe('Title is required');
    });

    it('announces a read-only field as disabled, and drops it again, as it becomes editable', async () => {
        const { getByLabelText, rerender } = await render(
            <Input label="Task title" editable={false} />
        );

        expect(getByLabelText('Task title').props['aria-disabled']).toBe(true);

        await rerender(<Input label="Task title" />);
        expect(getByLabelText('Task title').props['aria-disabled']).toBe(false);
    });

    it('lets the caller decide the disabled state over the editable flag', async () => {
        const { getByLabelText } = await render(
            <Input label="Task title" editable={false} aria-disabled={false} />
        );

        expect(getByLabelText('Task title').props['aria-disabled']).toBe(false);
    });

    // react-native-web maps `aria-*` props to the DOM and ignores `accessibilityState`, so a disabled
    // field is only announced as one on web when it is written as `aria-disabled`.
    it('puts its disabled and invalid state on the DOM input as aria attributes on web', () => {
        const readOnly = tagAttributes(
            renderOnWeb(loadInput, { label: 'Task title', editable: false }),
            'input'
        );
        const failing = tagAttributes(
            renderOnWeb(loadInput, { label: 'Task title', error: 'Title is required' }),
            'input'
        );

        expect(readOnly).toMatchObject({ 'aria-label': 'Task title', 'aria-disabled': 'true' });
        expect(failing).toMatchObject({ 'aria-label': 'Task title', 'aria-invalid': 'true' });
        expect(failing).not.toHaveProperty('aria-disabled');
    });

    // On web the browser settles two colour classes on one node by stylesheet order, not by the
    // order they are written in, so the helper text must carry exactly one of them.
    it('colours the error text as an error and not as a hint', async () => {
        const { getByText } = await render(
            <Input label="Task title" hint="Use a short title" error="Title is required" />
        );

        const helper = getByText('Title is required');

        expect(classesOf(helper)).toContain(ERROR_COLOUR);
        expect(classesOf(helper)).not.toContain(HINT_COLOUR);
    });

    it('colours the hint as a hint and not as an error', async () => {
        const { getByText } = await render(<Input label="Task title" hint="Use a short title" />);

        const helper = getByText('Use a short title');

        expect(classesOf(helper)).toContain(HINT_COLOUR);
        expect(classesOf(helper)).not.toContain(ERROR_COLOUR);
    });

    it('swaps the helper colour in both directions as the error appears and clears', async () => {
        const hint = 'Use a short title';
        const error = 'Title is required';
        const { getByText, rerender } = await render(<Input label="Task title" hint={hint} />);

        expect(colourClassesOf(getByText(hint))).toEqual([HINT_COLOUR]);

        await rerender(<Input label="Task title" hint={hint} error={error} />);
        expect(colourClassesOf(getByText(error))).toEqual([ERROR_COLOUR]);

        await rerender(<Input label="Task title" hint={hint} />);
        expect(colourClassesOf(getByText(hint))).toEqual([HINT_COLOUR]);
    });
});
