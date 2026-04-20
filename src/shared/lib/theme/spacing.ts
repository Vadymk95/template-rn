/**
 * Spacing ladder — template vocabulary.
 *
 * Zero in-repo references does NOT mean «unused» — it means «not used yet».
 * Do NOT trim steps by a call-count criterion. Extend the ladder; remove only
 * when a step is semantically wrong (ambiguous name, duplicates an existing
 * step, breaks monotonicity). See `.cursor/brain/DECISIONS.md` → «Design
 * tokens are vocabulary, not call sites».
 */
export const SPACING_TOKENS = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32
} as const;
