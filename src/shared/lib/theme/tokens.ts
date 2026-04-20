import {
    COLOR_TOKENS,
    COLOR_VALUES,
    getThemeColorValue,
    INTERACTION_STATE_TOKENS,
    type ThemeColorValueRole
} from '@/shared/lib/theme/colors';
import { CONTROL_SIZE_TOKENS, type ControlSize } from '@/shared/lib/theme/controlSizes';
import { RADII_TOKENS } from '@/shared/lib/theme/radii';
import { SPACING_TOKENS } from '@/shared/lib/theme/spacing';
import { TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/typography';

export const THEME_TOKENS = {
    colors: COLOR_TOKENS,
    colorValues: COLOR_VALUES,
    spacing: SPACING_TOKENS,
    radii: RADII_TOKENS,
    controlSizes: CONTROL_SIZE_TOKENS,
    typography: TYPOGRAPHY_TOKENS,
    states: INTERACTION_STATE_TOKENS
} as const;

export { COLOR_TOKENS, COLOR_VALUES, INTERACTION_STATE_TOKENS };
export { getThemeColorValue, type ThemeColorValueRole };
export { CONTROL_SIZE_TOKENS, type ControlSize };
export { RADII_TOKENS };
export { SPACING_TOKENS };
export { TYPOGRAPHY_TOKENS };
