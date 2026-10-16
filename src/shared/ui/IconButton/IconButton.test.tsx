import { render } from '@testing-library/react-native';

import { IconButton } from '@/shared/ui/IconButton/IconButton';
import { expectAccessibleControl } from '@/test/a11y';
import { renderOnWeb, tagAttributes } from '@/test/webDom';

jest.mock('@expo/vector-icons/Ionicons', () => ({
    __esModule: true,
    default: () => null
}));

const loadIconButton = () => require('@/shared/ui/IconButton/IconButton').IconButton;

describe('IconButton', () => {
    it('exposes a button role and its label, the only name an icon-only control has', async () => {
        await expectAccessibleControl(<IconButton icon="close" accessibilityLabel="Close" />, {
            role: 'button',
            name: 'Close'
        });
    });

    it('announces the disabled state, and drops it again, as the button is enabled', async () => {
        const { getByRole, queryByRole, rerender } = await render(
            <IconButton icon="close" accessibilityLabel="Close" disabled />
        );

        expect(getByRole('button', { name: 'Close', disabled: true })).toBeTruthy();

        await rerender(<IconButton icon="close" accessibilityLabel="Close" />);
        expect(queryByRole('button', { name: 'Close', disabled: true })).toBeNull();
    });

    // react-native-web maps `aria-*` props to the DOM and ignores `accessibilityState`.
    it('puts its disabled state on the DOM node as an aria attribute on web', () => {
        const props = { icon: 'close', accessibilityLabel: 'Close' } as const;

        const disabled = tagAttributes(renderOnWeb(loadIconButton, { ...props, disabled: true }));
        const enabled = tagAttributes(renderOnWeb(loadIconButton, props));

        expect(disabled).toMatchObject({
            role: 'button',
            'aria-label': 'Close',
            'aria-disabled': 'true'
        });
        // react-native-web writes `aria-disabled` only for a disabled node.
        expect(enabled).not.toHaveProperty('aria-disabled');
    });
});
