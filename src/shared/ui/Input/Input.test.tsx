import { render } from '@testing-library/react-native';
import { createRef } from 'react';
import { TextInput } from 'react-native';

import { Input } from '@/shared/ui/Input/Input';

describe('Input', () => {
    it('forwards its ref to the underlying text input', () => {
        const inputRef = createRef<TextInput>();

        render(<Input ref={inputRef} label="Task title" />);

        expect(inputRef.current).toBeTruthy();
    });

    it('marks the input invalid and exposes the error as an accessibility hint', () => {
        const { UNSAFE_getByType, getByText } = render(
            <Input label="Task title" error="Title is required" />
        );

        const input = UNSAFE_getByType(TextInput);

        expect(getByText('Title is required')).toBeTruthy();
        expect(input.props.accessibilityState).toEqual({
            disabled: false
        });
        expect(input.props['aria-invalid']).toBe(true);
        expect(input.props.accessibilityHint).toBe('Title is required');
    });
});
