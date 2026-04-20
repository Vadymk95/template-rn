import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Dialog } from '@/shared/ui/Dialog/Dialog';

jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => null
}));

describe('Dialog', () => {
    it('keeps the backdrop out of the accessibility tree', () => {
        const { UNSAFE_getByProps } = render(
            <Dialog visible title="Create task" onClose={jest.fn()}>
                <Text>Dialog content</Text>
            </Dialog>
        );

        const backdrop = UNSAFE_getByProps({
            className: 'absolute inset-0'
        });

        expect(backdrop.props.accessible).toBe(false);
        expect(backdrop.props.accessibilityLabel).toBeUndefined();
    });

    it('still closes when the backdrop is pressed', () => {
        const onClose = jest.fn();
        const { UNSAFE_getByProps } = render(
            <Dialog visible title="Create task" onClose={onClose}>
                <Text>Dialog content</Text>
            </Dialog>
        );

        const backdrop = UNSAFE_getByProps({
            className: 'absolute inset-0'
        });

        fireEvent.press(backdrop);

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
