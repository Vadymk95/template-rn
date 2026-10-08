import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const UI_DIR = join(process.cwd(), 'src/shared/ui');
const INTERACTIVE_HOST =
    /\b(Pressable|TextInput|Switch|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b/;
const GUARD_CALL = 'expectAccessibleControl(';

interface Primitive {
    name: string;
    source: string;
    testSource: string | null;
}

/** The interactive primitives whose own test never applies the accessibility helper. */
const findUnguarded = (primitives: readonly Primitive[]): string[] =>
    primitives
        .filter(({ source }) => INTERACTIVE_HOST.test(source))
        .filter(({ testSource }) => !testSource?.includes(GUARD_CALL))
        .map(({ name }) => name);

const readPrimitives = (): Primitive[] =>
    readdirSync(UI_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => {
            const files = readdirSync(join(UI_DIR, name)).filter((file) => file.endsWith('.tsx'));
            const read = (selected: string[]): string =>
                selected.map((file) => readFileSync(join(UI_DIR, name, file), 'utf8')).join('\n');
            const tests = files.filter((file) => file.endsWith('.test.tsx'));
            return {
                name,
                source: read(files.filter((file) => !file.endsWith('.test.tsx'))),
                testSource: tests.length > 0 ? read(tests) : null
            };
        });

/**
 * `expectAccessibleControl` only guards the components that call it, so a new Pressable-based
 * primitive added without that call would ship unguarded. This is the completeness half: every
 * folder in `src/shared/ui` whose component renders an interactive host must apply the helper in
 * its own test. Add the call to the new component's test, do not widen this check.
 */
describe('shared UI accessibility coverage', () => {
    it('applies expectAccessibleControl in the test of every interactive primitive', () => {
        const primitives = readPrimitives();

        expect(primitives.filter(({ source }) => INTERACTIVE_HOST.test(source))).not.toHaveLength(
            0
        );
        expect(findUnguarded(primitives)).toEqual([]);
    });

    it('reports an interactive primitive whose test has no accessibility guard', () => {
        const pressable = "import { Pressable } from 'react-native';";

        expect(
            findUnguarded([
                { name: 'Chip', source: pressable, testSource: null },
                { name: 'Fab', source: pressable, testSource: "it('renders', () => {});" },
                { name: 'Card', source: "import { View } from 'react-native';", testSource: null }
            ])
        ).toEqual(['Chip', 'Fab']);
    });

    it('accepts an interactive primitive whose test applies the guard', () => {
        expect(
            findUnguarded([
                {
                    name: 'Chip',
                    source: "import { Pressable } from 'react-native';",
                    testSource: 'await expectAccessibleControl(<Chip />, spec);'
                }
            ])
        ).toEqual([]);
    });
});
