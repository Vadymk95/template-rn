import {
    CONTROL_SIZE_TOKENS,
    MAX_FONT_SCALE_IN_FIXED_CONTROL
} from '@/shared/lib/theme/controlSizes';

/**
 * The font-scale bound is a DERIVED number, not a taste: it is the largest whole tenth that still keeps a
 * scaled label inside the smallest fixed-height control. These pin the derivation, so changing a control
 * height without recomputing the bound fails here instead of clipping text on someone's phone.
 */
describe('control sizes', () => {
    it('bounds the font scale without disabling scaling', () => {
        // `allowFontScaling={false}` ignores the user's accessibility setting outright and is never the
        // answer; a bound above 1 still honours the setting, just not to the point of clipping.
        expect(MAX_FONT_SCALE_IN_FIXED_CONTROL).toBeGreaterThan(1);
    });

    it('keeps a scaled label inside the smallest fixed-height control', () => {
        const smallest = Math.min(
            ...Object.values(CONTROL_SIZE_TOKENS).map((token) => token.height)
        );
        // A `sm` control is 36 points high; a 20-point line box scaled by the bound has to still fit.
        const lineBox = 20;

        expect(lineBox * MAX_FONT_SCALE_IN_FIXED_CONTROL).toBeLessThanOrEqual(smallest);
    });

    it('gives every size a height, a horizontal padding and an icon size', () => {
        for (const token of Object.values(CONTROL_SIZE_TOKENS)) {
            expect(token.height).toBeGreaterThan(0);
            expect(token.paddingHorizontal).toBeGreaterThan(0);
            expect(token.icon).toBeGreaterThan(0);
        }
    });
});
