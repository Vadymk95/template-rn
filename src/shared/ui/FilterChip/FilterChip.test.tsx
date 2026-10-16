import { render } from '@testing-library/react-native';

import { FilterChip } from '@/shared/ui/FilterChip/FilterChip';
import { expectAccessibleControl } from '@/test/a11y';
import { renderOnWeb, tagAttributes } from '@/test/webDom';

const loadFilterChip = () => require('@/shared/ui/FilterChip/FilterChip').FilterChip;

describe('FilterChip', () => {
    it('exposes a button role and its label', async () => {
        await expectAccessibleControl(<FilterChip label="Open tasks" />, {
            role: 'button',
            name: 'Open tasks'
        });
    });

    it('announces the selected state, and drops it again, as the selection changes', async () => {
        const { getByRole, queryByRole, rerender } = await render(
            <FilterChip label="Open tasks" />
        );

        expect(queryByRole('button', { name: 'Open tasks', selected: true })).toBeNull();

        await rerender(<FilterChip label="Open tasks" selected />);
        expect(getByRole('button', { name: 'Open tasks', selected: true })).toBeTruthy();

        await rerender(<FilterChip label="Open tasks" />);
        expect(queryByRole('button', { name: 'Open tasks', selected: true })).toBeNull();
    });

    it('announces the disabled state, and drops it again, as the chip is enabled', async () => {
        const { getByRole, queryByRole, rerender } = await render(
            <FilterChip label="Open tasks" disabled />
        );

        expect(getByRole('button', { name: 'Open tasks', disabled: true })).toBeTruthy();

        await rerender(<FilterChip label="Open tasks" />);
        expect(queryByRole('button', { name: 'Open tasks', disabled: true })).toBeNull();
    });

    // react-native-web maps `aria-*` props to the DOM and ignores `accessibilityState`, so the state
    // is only visible to a browser (and its screen reader) when it is written as `aria-*`.
    it('puts its state on the DOM node as aria attributes on web', () => {
        const selected = tagAttributes(
            renderOnWeb(loadFilterChip, { label: 'Open tasks', selected: true })
        );
        const cleared = tagAttributes(
            renderOnWeb(loadFilterChip, { label: 'Open tasks', selected: false })
        );
        const disabled = tagAttributes(
            renderOnWeb(loadFilterChip, { label: 'Open tasks', disabled: true })
        );

        expect(selected).toMatchObject({
            role: 'button',
            'aria-label': 'Open tasks',
            'aria-selected': 'true'
        });
        expect(cleared).toMatchObject({ 'aria-selected': 'false' });
        expect(disabled).toMatchObject({ 'aria-disabled': 'true' });
    });
});
