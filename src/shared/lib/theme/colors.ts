export const COLOR_TOKENS = {
    background: 'bg-background',
    surface: 'bg-background',
    surfaceMuted: 'bg-muted',
    border: 'border-border',
    textPrimary: 'text-foreground',
    textSecondary: 'text-muted-foreground',
    accent: 'bg-primary',
    accentForeground: 'text-primary-foreground',
    accentBorder: 'border-primary',
    danger: 'bg-destructive',
    dangerForeground: 'text-primary-foreground',
    dangerBorder: 'border-destructive'
} as const;

export const COLOR_VALUES = {
    light: {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        surfaceMuted: '#F4F4F5',
        border: '#E4E4E7',
        textPrimary: '#09090B',
        textSecondary: '#71717A',
        accent: '#18181B',
        accentForeground: '#FAFAFA',
        danger: '#E11D48',
        dangerForeground: '#FAFAFA',
        backdrop: 'rgba(9, 9, 11, 0.45)'
    },
    dark: {
        background: '#09090B',
        surface: '#09090B',
        surfaceMuted: '#27272A',
        border: '#27272A',
        textPrimary: '#FAFAFA',
        textSecondary: '#A1A1AA',
        accent: '#FAFAFA',
        accentForeground: '#09090B',
        danger: '#FB7185',
        dangerForeground: '#09090B',
        backdrop: 'rgba(9, 9, 11, 0.65)'
    }
} as const;

export const INTERACTION_STATE_TOKENS = {
    pressedOpacity: 0.88,
    disabledOpacity: 0.5
} as const;

export type ThemeColorValueRole = keyof (typeof COLOR_VALUES)['light'];

export const getThemeColorValue = (
    colorScheme: 'light' | 'dark' | null | undefined,
    role: ThemeColorValueRole
): string => COLOR_VALUES[colorScheme === 'dark' ? 'dark' : 'light'][role];
