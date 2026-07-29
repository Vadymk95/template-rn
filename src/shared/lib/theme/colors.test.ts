import { COLOR_VALUES, getThemeColorValue } from '@/shared/lib/theme/colors';

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
