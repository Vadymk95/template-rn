import { COLOR_VALUES } from '@/shared/lib/theme/colors';

/**
 * Active tint for the tab bar. React Navigation's `screenOptions` needs a real
 * colour value, not a NativeWind class, so it reads the token table instead of
 * holding a literal — a hardcoded copy had already drifted from the theme.
 *
 * Known limitation: this is the LIGHT value and the tab bar does not follow the
 * colour scheme. Making it theme-aware means reading `useColorScheme()` in the
 * tabs layout and passing `getThemeColorValue(scheme, 'textPrimary')`; that is a
 * behaviour change with its own test, not a constant.
 */
export const TAB_BAR_ACTIVE_TINT = COLOR_VALUES.light.textPrimary;
