import { fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

import { Button } from '@/shared/ui/Button/Button';

describe('Button', () => {
    it('renders the label and calls onPress', () => {
        const onPress = jest.fn();
        const { getByRole, getByText } = render(<Button label="Create task" onPress={onPress} />);

        fireEvent.press(getByRole('button'));

        expect(getByText('Create task')).toBeTruthy();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders children instead of the label when custom content is provided', () => {
        const { getByText, queryByText } = render(
            <Button label="Hidden label">
                <Text>Custom content</Text>
            </Button>
        );

        expect(getByText('Custom content')).toBeTruthy();
        expect(queryByText('Hidden label')).toBeNull();
    });

    it('renders optional left and right slots', () => {
        const leftSlot = createElement(Text, undefined, 'Left icon');
        const rightSlot = createElement(Text, undefined, 'Right icon');
        const { getByText } = render(
            <Button label="Open" leftSlot={leftSlot} rightSlot={rightSlot} />
        );

        expect(getByText('Left icon')).toBeTruthy();
        expect(getByText('Open')).toBeTruthy();
        expect(getByText('Right icon')).toBeTruthy();
    });

    it('prevents presses while disabled or loading', () => {
        const onPress = jest.fn();
        const disabledRender = render(<Button label="Disabled" onPress={onPress} disabled />);

        fireEvent.press(disabledRender.getByRole('button'));
        expect(onPress).not.toHaveBeenCalled();

        disabledRender.unmount();

        const loadingRender = render(<Button label="Loading" onPress={onPress} loading />);
        const loadingButton = loadingRender.getByRole('button');

        fireEvent.press(loadingButton);

        expect(onPress).not.toHaveBeenCalled();
        expect(loadingButton.props.accessibilityState).toEqual({
            busy: true,
            disabled: true
        });
    });

    it('warns in development when custom content buttons have no accessible label', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());

        render(
            <Button>
                <Text>Custom content</Text>
            </Button>
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[warn] [Button] Provide `label` or `accessibilityLabel` when rendering custom content.',
            ''
        );

        consoleWarnSpy.mockRestore();
    });
});
