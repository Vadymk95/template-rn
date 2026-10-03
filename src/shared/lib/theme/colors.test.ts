import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    COLOR_VALUES,
    getThemeColorValue,
    type ThemeColorValueRole
} from '@/shared/lib/theme/colors';

// `getThemeColorValue` is the only place a raw colour value leaves the token table
// (React Navigation options, native props, Reanimated — anywhere a NativeWind class
// cannot go). Its dark branch was uncovered while the tab bar shipped a hardcoded
// light value, so this pins both branches and the fallback.
describe('getThemeColorValue', () => {
    it('returns the light value for the light scheme', () => {
        expect(getThemeColorValue('light', 'textPrimary')).toBe(COLOR_VALUES.light.textPrimary);
    });

    it('returns the dark value for the dark scheme', () => {
        expect(getThemeColorValue('dark', 'textPrimary')).toBe(COLOR_VALUES.dark.textPrimary);
    });

    it('resolves light and dark to different values, so a caller cannot ignore the scheme', () => {
        expect(getThemeColorValue('dark', 'textPrimary')).not.toBe(
            getThemeColorValue('light', 'textPrimary')
        );
    });

    it.each([
        ['null', null],
        ['undefined', undefined]
    ])('falls back to light when the scheme is %s', (_label, scheme) => {
        expect(getThemeColorValue(scheme, 'background')).toBe(COLOR_VALUES.light.background);
    });

    it('reads every role from the table it was asked for', () => {
        for (const role of Object.keys(COLOR_VALUES.dark) as (keyof typeof COLOR_VALUES.dark)[]) {
            expect(getThemeColorValue('dark', role)).toBe(COLOR_VALUES.dark[role]);
        }
    });
});

// CSS Color 4 HSL -> sRGB hex, the browser/RN-engine algorithm — not a hand-rolled approximation.
// Module scope: neither helper captures anything from a call site, so there is nothing to recreate.
const toHex = (x: number): string =>
    Math.round(255 * x)
        .toString(16)
        .padStart(2, '0');

const hslToHex = (h: number, s: number, l: number): string => {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const k = (n: number): number => (n + h / 30) % 12;
    const a = sNorm * Math.min(lNorm, 1 - lNorm);
    const f = (n: number): number =>
        lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
};

// Colour has exactly two homes (see the "No raw hex colours" eslint rule, eslint.config.mjs): the
// NativeWind theme in `global.css` (consumed as `className`) and `COLOR_VALUES` here (consumed where
// a native API needs a real value — navigation options, Reanimated, native props). The two are
// maintained by hand in two different files and two different colour formats (HSL vs hex), so nothing
// stops them drifting apart silently; this pins every duplicated role to the SAME computed colour.
describe('COLOR_VALUES stays in sync with global.css', () => {
    const css = readFileSync(path.join(process.cwd(), 'global.css'), 'utf8');

    /** Variables inside a `{...}` block matched by `blockPattern`, as computed hex. */
    const readCssVariablesHex = (blockPattern: RegExp): Record<string, string> => {
        const body = css.match(blockPattern)?.[1];
        if (body === undefined) {
            throw new Error(`global.css: no block matched ${blockPattern.toString()}`);
        }
        const values: Record<string, string> = {};
        const varPattern = /--([a-z-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g;
        for (const match of body.matchAll(varPattern)) {
            const [, name, h, s, l] = match;
            if (name === undefined || h === undefined || s === undefined || l === undefined) {
                continue;
            }
            values[name] = hslToHex(Number(h), Number(s), Number(l));
        }
        return values;
    };

    // Anchored to line-start so `:root` never matches inside `.dark:root`.
    const lightCss = readCssVariablesHex(/(?:^|\n)\s*:root\s*{([^}]*)}/);
    const darkCss = readCssVariablesHex(/\.dark:root\s*{([^}]*)}/);

    const DUPLICATED_ROLES: { cssVar: string; colorValueRole: ThemeColorValueRole }[] = [
        { cssVar: 'background', colorValueRole: 'background' },
        { cssVar: 'foreground', colorValueRole: 'textPrimary' },
        { cssVar: 'primary', colorValueRole: 'accent' },
        { cssVar: 'primary-foreground', colorValueRole: 'accentForeground' },
        { cssVar: 'primary-foreground', colorValueRole: 'dangerForeground' },
        { cssVar: 'muted', colorValueRole: 'surfaceMuted' },
        { cssVar: 'muted-foreground', colorValueRole: 'textSecondary' },
        { cssVar: 'border', colorValueRole: 'border' },
        { cssVar: 'destructive', colorValueRole: 'danger' }
    ];

    it.each(DUPLICATED_ROLES)(
        'light: --$cssVar equals COLOR_VALUES.light.$colorValueRole',
        ({ cssVar, colorValueRole }) => {
            expect(COLOR_VALUES.light[colorValueRole]).toBe(lightCss[cssVar]);
        }
    );

    it.each(DUPLICATED_ROLES)(
        'dark: --$cssVar equals COLOR_VALUES.dark.$colorValueRole',
        ({ cssVar, colorValueRole }) => {
            expect(COLOR_VALUES.dark[colorValueRole]).toBe(darkCss[cssVar]);
        }
    );
});
