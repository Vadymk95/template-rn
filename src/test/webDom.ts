import type { ComponentType } from 'react';

/**
 * Renders one component through react-native-web to static HTML, which is what a browser receives.
 *
 * The native test renderer cannot show what reaches the DOM: React Native's `Pressable` consumes the
 * `aria-*` props and rewrites them into `accessibilityState` before the host node exists, and
 * react-native-web maps only some of the accessibility props, so a prop that works on a device can
 * be dropped on web. This is the one place a test can read the attributes a browser would see.
 *
 * `load` must require the component INSIDE the callback it returns from (`() => require('@/...').X`),
 * because only modules loaded while this call runs are bound to react-native-web; an import at the
 * top of the spec is already bound to React Native. The modules are isolated so nothing leaks into
 * the rest of the spec file.
 */
export const renderOnWeb = <Props extends object>(
    load: () => ComponentType<Props>,
    props: Props
): string => {
    let html = '';

    jest.isolateModules(() => {
        jest.doMock('react-native', () => require('react-native-web'));
        try {
            const { createElement } = require('react');
            const { renderToStaticMarkup } = require('react-dom/server');

            html = renderToStaticMarkup(createElement(load(), props));
        } finally {
            jest.dontMock('react-native');
        }
    });

    return html;
};

/**
 * The attributes of the first `<tag>` in a static HTML string (any tag when none is named), as the
 * browser would see them. A boolean attribute such as `disabled` comes back as an empty string.
 */
export const tagAttributes = (html: string, tag = '[a-z][a-z0-9]*'): Record<string, string> => {
    const open = new RegExp(`<${tag}\\b([^>]*?)/?>`).exec(html);
    const attributes: Record<string, string> = {};

    for (const [, name, value] of (open?.[1] ?? '').matchAll(/([^\s="]+)(?:="([^"]*)")?/g)) {
        if (name !== undefined) {
            attributes[name] = value ?? '';
        }
    }

    return attributes;
};
