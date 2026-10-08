import { IconButton } from '@/shared/ui/IconButton/IconButton';
import { expectAccessibleControl } from '@/test/a11y';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

describe('IconButton', () => {
    it('exposes a button role and its label, the only name an icon-only control has', async () => {
        await expectAccessibleControl(<IconButton icon="close" accessibilityLabel="Close" />, {
            role: 'button',
            name: 'Close'
        });
    });
});
