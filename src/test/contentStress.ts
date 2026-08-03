/**
 * The content-variance contract for this app: which states exist and how each one transforms authored
 * copy.
 *
 * Why it is a test module and not a fixture SCREEN, unlike the web siblings: there is no browser here.
 * Playwright measures a rendered box; RNTL renders to a tree with no layout engine behind it, so a test
 * can assert the PROPS that bound a layout and nothing about the resulting pixels. That limit is real
 * and is written down rather than papered over — the props are what a reviewer can check, and the pixels
 * need a device.
 *
 * The native axes differ from the web ones too. There is no `overflow-wrap` to forget; what actually
 * breaks a native screen is an unbounded line count in a summary row, a row whose text sibling cannot
 * shrink, and the OS font-scale slider — which has no web equivalent and is the axis most often missed.
 */

export const STRESS_STATE = {
    MINIMAL: 'minimal',
    TYPICAL: 'typical',
    LONG: 'long',
    UNBROKEN: 'unbroken',
    NONE: 'none',
    ONE: 'one',
    MANY: 'many'
} as const;

export type StressState = (typeof STRESS_STATE)[keyof typeof STRESS_STATE];

export const TEXT_STATES = [
    STRESS_STATE.MINIMAL,
    STRESS_STATE.TYPICAL,
    STRESS_STATE.LONG,
    STRESS_STATE.UNBROKEN
] as const;

export const COLLECTION_STATES = [STRESS_STATE.NONE, STRESS_STATE.ONE, STRESS_STATE.MANY] as const;

export const ALL_STATES = [...TEXT_STATES, ...COLLECTION_STATES] as const;

const UNBROKEN_TOKEN_PAIRS = 20;

/**
 * A single unbroken token. On native this is what finds a row whose text sibling cannot shrink: a long
 * SENTENCE wraps on its spaces and hides the same defect.
 */
export const UNBROKEN_TOKEN = 'Xx'.repeat(UNBROKEN_TOKEN_PAIRS);

/** One character, not the empty string: an unreadable label is a content bug, not a layout one. */
export const MINIMAL_TEXT = 'x';

const TYPICAL_ITEM_COUNT = 3;
const MANY_ITEM_COUNT = 7;

/**
 * The largest OS font scale worth asserting against. iOS and Android both go well past this with the
 * accessibility sizes enabled; 2 is the point where a fixed-height control is unambiguously in trouble.
 */
export const STRESS_FONT_SCALE = 2;

/** Exhaustive on purpose — no `default`, so a new state has to be decided rather than fall through. */
export const transformText = (value: string, state: StressState): string => {
    switch (state) {
        case STRESS_STATE.MINIMAL:
            return MINIMAL_TEXT;
        case STRESS_STATE.LONG:
            return `${value} ${value} ${value}`;
        case STRESS_STATE.UNBROKEN:
            return UNBROKEN_TOKEN;
        case STRESS_STATE.TYPICAL:
        case STRESS_STATE.NONE:
        case STRESS_STATE.ONE:
        case STRESS_STATE.MANY:
            return value;
    }
};

export const resolveItemCount = (state: StressState): number => {
    switch (state) {
        case STRESS_STATE.NONE:
            return 0;
        case STRESS_STATE.ONE:
            return 1;
        case STRESS_STATE.MANY:
            return MANY_ITEM_COUNT;
        case STRESS_STATE.MINIMAL:
        case STRESS_STATE.TYPICAL:
        case STRESS_STATE.LONG:
        case STRESS_STATE.UNBROKEN:
            return TYPICAL_ITEM_COUNT;
    }
};
