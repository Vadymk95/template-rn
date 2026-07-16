import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Dialog } from '@/shared/ui/Dialog/Dialog';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

describe('Dialog', () => {
    it('keeps the backdrop out of the accessibility tree', async () => {
        const { getByTestId } = await render(
            <Dialog visible title="Create task" onClose={jest.fn()}>
                <Text>Dialog content</Text>
            </Dialog>
        );

        // The backdrop is intentionally hidden from the accessibility tree, so
        // the query must opt in to hidden elements to reach it at all.
        const backdrop = getByTestId('dialog-backdrop', { includeHiddenElements: true });

        expect(backdrop.props['accessible']).toBe(false);
        expect(backdrop.props['accessibilityLabel']).toBeUndefined();
    });

    it('still closes when the backdrop is pressed', async () => {
        const onClose = jest.fn();
        const { getByTestId } = await render(
            <Dialog visible title="Create task" onClose={onClose}>
                <Text>Dialog content</Text>
            </Dialog>
        );

        await fireEvent.press(getByTestId('dialog-backdrop', { includeHiddenElements: true }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
