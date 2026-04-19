import type IoniconsBase from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IoniconGlyphName = ComponentProps<typeof IoniconsBase>['name'];

/** Tab route `name` prop → Ionicons glyph (Expo vector-icons contract). */
export const TAB_SCREEN_IONICONS: Record<'index' | 'settings', IoniconGlyphName> = {
    index: 'home-outline',
    settings: 'settings-outline'
} as const;
