/**
 * Typography scale — template vocabulary.
 *
 * Zero in-repo references does NOT mean «unused» — it means «not used yet»
 * until a forked product slice reaches for a given step. Do NOT trim tokens
 * by a call-count criterion. Extend the ladder; remove only when a token is
 * semantically wrong. See `.cursor/brain/DECISIONS.md` → «Design tokens are
 * vocabulary, not call sites».
 */
export const TYPOGRAPHY_TOKENS = {
    screenTitle: 'text-3xl font-bold tracking-tight text-foreground',
    sectionTitle: 'text-lg font-semibold text-foreground',
    cardTitle: 'text-base font-semibold text-foreground',
    body: 'text-base text-foreground',
    bodyMuted: 'text-sm text-muted-foreground',
    label: 'text-sm font-medium text-foreground',
    button: 'text-sm font-semibold',
    caption: 'text-xs text-muted-foreground'
} as const;
