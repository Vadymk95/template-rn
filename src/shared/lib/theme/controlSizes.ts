export const CONTROL_SIZE_TOKENS = {
    sm: {
        height: 36,
        paddingHorizontal: 12,
        icon: 16,
        gap: 8
    },
    md: {
        height: 44,
        paddingHorizontal: 16,
        icon: 18,
        gap: 10
    },
    lg: {
        height: 52,
        paddingHorizontal: 20,
        icon: 20,
        gap: 12
    }
} as const;

export type ControlSize = keyof typeof CONTROL_SIZE_TOKENS;
