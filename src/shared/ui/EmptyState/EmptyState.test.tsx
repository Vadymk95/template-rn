import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

describe('EmptyState', () => {
    it('renders title and description for the default icon path', () => {
        const { getByText } = render(<EmptyState title="Title A" description="Body B" />);

        expect(getByText('Title A')).toBeTruthy();
        expect(getByText('Body B')).toBeTruthy();
    });

    it('renders when a custom icon name is provided', () => {
        const { getByText } = render(
            <EmptyState title="T" description="D" icon="filter-outline" />
        );

        expect(getByText('T')).toBeTruthy();
    });

    it('renders the action and calls onActionPress when both are provided', () => {
        const onActionPress = jest.fn();
        const { getByRole } = render(
            <EmptyState
                title="T"
                description="D"
                actionLabel="Retry"
                onActionPress={onActionPress}
            />
        );

        fireEvent.press(getByRole('button', { name: 'Retry' }));
        expect(onActionPress).toHaveBeenCalledTimes(1);
    });

    it('omits the action button when actionLabel is absent', () => {
        const onActionPress = jest.fn();
        const { queryByRole, getByText } = render(
            <EmptyState title="T" description="D" onActionPress={onActionPress} />
        );

        expect(getByText('T')).toBeTruthy();
        expect(queryByRole('button')).toBeNull();
    });
});
