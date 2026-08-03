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

/**
 * Upper bound on the OS font-scale multiplier for text inside a control with a FIXED height.
 *
 * The heights above are fixed, and `<Text>` scales with the system setting by default, so at the large
 * end of the accessibility slider a label grows past the box and is clipped — the control still reports
 * its 44 points while the words are cut off. Capping the multiplier keeps the label readable AND inside
 * the box; it does not disable scaling.
 *
 * 1.6 is not arbitrary: `md` is 44 points high with a 20-point line box, so 1.6 is the largest whole
 * tenth that still leaves the label inside the control. Recompute it if the heights change — and never
 * reach for `allowFontScaling={false}`, which ignores the user's setting outright.
 */
export const MAX_FONT_SCALE_IN_FIXED_CONTROL = 1.6;
