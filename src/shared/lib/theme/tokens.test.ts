import {
    CONTROL_SIZE_TOKENS as SOURCE_CONTROL_SIZE_TOKENS,
    MAX_FONT_SCALE_IN_FIXED_CONTROL as SOURCE_MAX_FONT_SCALE
} from '@/shared/lib/theme/controlSizes';
import { MAX_FONT_SCALE_IN_FIXED_CONTROL, THEME_TOKENS } from '@/shared/lib/theme/tokens';

/**
 * This module is the barrel every consumer imports tokens through, so the failure worth guarding is a
 * re-export that silently stops pointing at its source. A dropped or shadowed name does not fail the
 * build — it fails at the use site, later, as an `undefined`.
 */
describe('theme tokens barrel', () => {
    it('re-exports the font-scale bound as the same value the source defines', () => {
        expect(MAX_FONT_SCALE_IN_FIXED_CONTROL).toBe(SOURCE_MAX_FONT_SCALE);
    });

    it('exposes the control sizes through the grouped token object', () => {
        expect(THEME_TOKENS.controlSizes).toBe(SOURCE_CONTROL_SIZE_TOKENS);
    });
});
