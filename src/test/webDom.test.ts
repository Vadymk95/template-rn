import { View as NativeView } from 'react-native';

import { renderOnWeb, tagAttributes } from '@/test/webDom';

const loadView = () => require('react-native').View;

describe('renderOnWeb', () => {
    it('shows an aria prop on the DOM node', () => {
        const html = renderOnWeb(loadView, { 'aria-selected': true });

        expect(tagAttributes(html)['aria-selected']).toBe('true');
    });

    // The premise of the lint rule against `accessibilityState` in src: react-native-web does not map
    // it, so the state never reaches the DOM. If this turns red, react-native-web learned to map it:
    // drop the rule and revisit this test.
    it('drops accessibilityState, which only React Native understands', () => {
        const html = renderOnWeb(loadView, { accessibilityState: { selected: true } });

        expect(tagAttributes(html)).not.toHaveProperty('aria-selected');
    });

    it('leaves React Native in place for the rest of the spec', () => {
        renderOnWeb(loadView, {});

        expect(require('react-native').View).toBe(NativeView);
    });
});

describe('tagAttributes', () => {
    it('reads quoted values, values with spaces and boolean attributes', () => {
        const html =
            '<button aria-label="Open tasks" class="a b" disabled="" tabindex="-1"><div id="x"/>';

        expect(tagAttributes(html)).toEqual({
            'aria-label': 'Open tasks',
            class: 'a b',
            disabled: '',
            tabindex: '-1'
        });
    });

    it('reads the first tag of the requested name', () => {
        const html =
            '<div id="outer"><input aria-invalid="true"/><input aria-invalid="false"/></div>';

        expect(tagAttributes(html, 'input')).toEqual({ 'aria-invalid': 'true' });
    });

    it('returns nothing when the tag is absent', () => {
        expect(tagAttributes('<div id="x"></div>', 'input')).toEqual({});
    });
});
