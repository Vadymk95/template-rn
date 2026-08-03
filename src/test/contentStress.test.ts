import {
    ALL_STATES,
    MINIMAL_TEXT,
    resolveItemCount,
    STRESS_STATE,
    transformText,
    UNBROKEN_TOKEN
} from '@/test/contentStress';

/**
 * The transforms are where a content state can quietly become a no-op, and a no-op state means every
 * component test that loops the matrix is measuring the same thing several times and passing.
 */
describe('content stress states', () => {
    const source = 'Review the onboarding copy';

    it('makes every text state produce a different string', () => {
        const rendered = new Set(
            [
                STRESS_STATE.MINIMAL,
                STRESS_STATE.TYPICAL,
                STRESS_STATE.LONG,
                STRESS_STATE.UNBROKEN
            ].map((state) => transformText(source, state))
        );

        expect(rendered.size).toBe(4);
    });

    it('keeps the unbroken state a single token, which is the whole point of it', () => {
        const unbroken = transformText(source, STRESS_STATE.UNBROKEN);

        expect(unbroken).not.toContain(' ');
        expect(unbroken).toBe(UNBROKEN_TOKEN);
        expect(unbroken.length).toBeGreaterThan(source.length);
    });

    it('shortens rather than empties, because an empty label is a content bug not a layout one', () => {
        expect(transformText(source, STRESS_STATE.MINIMAL)).toBe(MINIMAL_TEXT);
        expect(MINIMAL_TEXT).toHaveLength(1);
    });

    it('lengthens by repeating real copy rather than inventing filler', () => {
        expect(transformText(source, STRESS_STATE.LONG)).toBe(`${source} ${source} ${source}`);
    });

    it('leaves copy untouched for the collection states, which vary the count instead', () => {
        for (const state of [STRESS_STATE.NONE, STRESS_STATE.ONE, STRESS_STATE.MANY]) {
            expect(transformText(source, state)).toBe(source);
        }
    });

    it('spans empty, one and many, and orders them', () => {
        expect(resolveItemCount(STRESS_STATE.NONE)).toBe(0);
        expect(resolveItemCount(STRESS_STATE.ONE)).toBe(1);
        expect(resolveItemCount(STRESS_STATE.MANY)).toBeGreaterThan(
            resolveItemCount(STRESS_STATE.TYPICAL)
        );
        expect(resolveItemCount(STRESS_STATE.TYPICAL)).toBeGreaterThan(
            resolveItemCount(STRESS_STATE.ONE)
        );
    });

    it('handles every declared state — none falls through unhandled', () => {
        for (const state of ALL_STATES) {
            expect(transformText(source, state).length).toBeGreaterThan(0);
            expect(resolveItemCount(state)).toBeGreaterThanOrEqual(0);
        }
    });
});
