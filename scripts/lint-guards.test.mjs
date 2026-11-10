// The lint rules that stand between an agent and a bug no other part of the gate can see: the types
// pass, the tests render on a device-less renderer, and the failure only shows up in the compiled
// app or in a browser. Each case lints a snippet with THIS repo's own ESLint config and asserts that
// the rule fires on the bad form and stays silent on the good one, so a config edit that drops or
// narrows a guard turns this file red instead of passing unnoticed.
//
// Type-aware linting only accepts files the TypeScript project knows, so every snippet borrows the
// path of a real source file: the snippet's text replaces that file's content in memory and nothing
// is written to disk.
//
// Runner: `node:test`, like the other gate specs here. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: process.cwd() });

const TS_FILE = 'src/lib/utils.ts';
const TSX_FILE = 'src/shared/ui/Card/Card.tsx';
const TEST_FILE = 'src/shared/ui/Button/Button.test.tsx';

// Only the rule under test is returned: a snippet is not written to satisfy every other rule of the
// config. A snippet that does not parse at all is the one thing that must never read as "no finding".
const restrictedSyntax = async (code, filePath) => {
    const [result] = await eslint.lintText(code, { filePath });
    const fatal = result.messages.filter(({ fatal: isFatal }) => isFatal);

    assert.deepEqual(fatal, [], 'the snippet must parse');

    return result.messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax');
};

const restrictedProperties = async (code, filePath) => {
    const [result] = await eslint.lintText(code, { filePath });
    const fatal = result.messages.filter(({ fatal: isFatal }) => isFatal);

    assert.deepEqual(fatal, [], 'the snippet must parse');

    return result.messages.filter(({ ruleId }) => ruleId === 'no-restricted-properties');
};

const magicNumbers = async (code, filePath) => {
    const [result] = await eslint.lintText(code, { filePath });
    const fatal = result.messages.filter(({ fatal: isFatal }) => isFatal);

    assert.deepEqual(fatal, [], 'the snippet must parse');

    return result.messages.filter(({ ruleId }) => ruleId === '@typescript-eslint/no-magic-numbers');
};

// The same snippet through oxlint with this repo's config. The snippet is written outside the repo
// (oxlint needs no TypeScript project), and the rule codes come back as `plugin(rule)`.
const oxlintCodes = (code) => {
    const dir = mkdtempSync(join(tmpdir(), 'oxlint-snippet-'));

    try {
        const file = join(dir, 'snippet.ts');

        writeFileSync(file, code);

        const run = spawnSync(
            process.execPath,
            [
                join(process.cwd(), 'node_modules/oxlint/bin/oxlint'),
                '--config',
                join(process.cwd(), '.oxlintrc.json'),
                '--format',
                'json',
                file
            ],
            { encoding: 'utf8' }
        );

        return JSON.parse(run.stdout).diagnostics.map(({ code: rule }) => rule);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};

describe('store reads under the React Compiler', () => {
    // The compiler does not see `useStore.use.field()` as a hook, caches the call in a block that runs
    // on the first render only, and React then throws "Rendered fewer hooks than expected".
    it('flags a call through a .use member', async () => {
        const found = await restrictedSyntax(
            [
                "import { useUserStore } from '@/store/user/userStore';",
                '',
                'export const useUsername = (): string | null => useUserStore.use.username();',
                ''
            ].join('\n'),
            TS_FILE
        );

        assert.equal(found.length, 1);
        assert.match(found[0].message, /useStore\(\(state\) => state\.field\)/);
    });

    it('accepts a plain selector and useShallow', async () => {
        const found = await restrictedSyntax(
            [
                "import { useShallow } from 'zustand/react/shallow';",
                '',
                "import { useUserStore } from '@/store/user/userStore';",
                '',
                'export const useUsername = (): string | null => useUserStore((s) => s.username);',
                '',
                'export const useSession = (): { username: string | null; hydrated: boolean } =>',
                '    useUserStore(',
                '        useShallow((s) => ({ username: s.username, hydrated: s._hasHydrated }))',
                '    );',
                ''
            ].join('\n'),
            TS_FILE
        );

        assert.deepEqual(found, []);
    });
});

describe('accessibility state on web', () => {
    // react-native-web does not map `accessibilityState`, so a state written that way never reaches
    // the DOM; the `aria-*` props reach both a device and a browser.
    it('flags accessibilityState on any element', async () => {
        const found = await restrictedSyntax(
            [
                "import type { ReactElement } from 'react';",
                "import { Pressable } from 'react-native';",
                '',
                'export const Chip = (): ReactElement => <Pressable accessibilityState={{ selected: true }} />;',
                ''
            ].join('\n'),
            TSX_FILE
        );

        assert.equal(found.length, 1);
        assert.match(found[0].message, /aria-\*/);
    });

    it('accepts the aria props', async () => {
        const found = await restrictedSyntax(
            [
                "import type { ReactElement } from 'react';",
                "import { Pressable } from 'react-native';",
                '',
                'export const Chip = (): ReactElement => (',
                '    <Pressable aria-selected aria-disabled={false} aria-busy={false} />',
                ');',
                ''
            ].join('\n'),
            TSX_FILE
        );

        assert.deepEqual(found, []);
    });

    it('leaves tests free to read the state a component derives', async () => {
        const found = await restrictedSyntax(
            [
                "import { Pressable } from 'react-native';",
                '',
                "it('renders', () => {",
                '    expect(<Pressable accessibilityState={{ selected: true }} />).toBeTruthy();',
                '});',
                ''
            ].join('\n'),
            TEST_FILE
        );

        assert.deepEqual(found, []);
    });
});

describe('array methods the iOS engine lacks', () => {
    // Measured on Expo Go 57.0.9 in the iOS Simulator: `typeof [].toSorted` is "undefined" while
    // `toReversed`, `toSpliced` and `with` are functions. Web and Jest run on engines that have
    // `toSorted`, so only a device throws "undefined is not a function".
    it('flags toSorted under src', async () => {
        const found = await restrictedProperties(
            [
                'export const sortAscending = (items: number[]): number[] =>',
                '    items.toSorted((a, b) => a - b);',
                ''
            ].join('\n'),
            TS_FILE
        );

        assert.equal(found.length, 1);
        assert.match(found[0].message, /Hermes/);
        assert.match(found[0].message, /\[\.\.\.items\]\.sort/);
    });

    it('accepts copy-then-sort and the methods the engine has', async () => {
        const found = await restrictedProperties(
            [
                'export const sortAscending = (items: number[]): number[] =>',
                '    [...items].sort((a, b) => a - b);',
                '',
                'export const newest = (items: number[]): number[] => items.toReversed();',
                ''
            ].join('\n'),
            TS_FILE
        );

        assert.deepEqual(found, []);
    });

    it('does not make oxlint demand toSorted', () => {
        const codes = oxlintCodes(
            [
                'debugger;',
                'export const sortAscending = (items: number[]): number[] =>',
                '    [...items].sort((a, b) => a - b);',
                ''
            ].join('\n')
        );

        // `debugger` proves oxlint ran with this repo's config and can still report.
        assert.ok(codes.includes('eslint(no-debugger)'), codes.join(', '));
        assert.ok(!codes.includes('unicorn(no-array-sort)'), codes.join(', '));
    });
});

describe('a numeric literal type is not a magic number', () => {
    // `type Gap = 3 | 5` names its numbers already; the rule used to ask for a constant behind each.
    it('accepts a union of numeric literal types declared as an alias', async () => {
        const found = await magicNumbers('export type Gap = 3 | 5;\n', TS_FILE);

        assert.deepEqual(found, []);
    });

    it('still counts the same numbers used as values', async () => {
        const found = await magicNumbers(
            'export const scale = (n: number): number => n * 3 + 5;\n',
            TS_FILE
        );

        assert.equal(found.length, 2);
    });

    // The option covers a union that is the whole alias; one written inside a property type is not
    // covered, which is why the rule note tells the author to name it as an alias.
    it('still counts a union written inline in a property type', async () => {
        const found = await magicNumbers(
            'export interface Props {\n    max?: 4 | 5;\n}\n',
            TS_FILE
        );

        assert.equal(found.length, 2);
    });
});

describe('a timer started in an effect is released by its cleanup', () => {
    // A real source file's path: type-aware linting only accepts files the TypeScript project knows.
    const SOURCE_FILE = 'src/hooks/useStoreReady.ts';
    const ERROR_SEVERITY = 2;

    // React Native has no DOM listeners or observers, so only the two timer rules apply. Each case is
    // a hook that starts the timer and returns nothing, and the same hook with the cleanup returned. A
    // timer that outlives its component keeps running after unmount and holds the component's state.
    const CASES = [
        {
            rule: 'react-web-api/no-leaked-interval',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useTick = (onTick: () => void): void => {',
                '    useEffect(() => {',
                '        setInterval(onTick, 500);',
                '    }, [onTick]);',
                '};',
                ''
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useTick = (onTick: () => void): void => {',
                '    useEffect(() => {',
                '        const id = setInterval(onTick, 500);',
                '        return () => clearInterval(id);',
                '    }, [onTick]);',
                '};',
                ''
            ]
        },
        {
            rule: 'react-web-api/no-leaked-timeout',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useDelay = (onDone: () => void): void => {',
                '    useEffect(() => {',
                '        setTimeout(onDone, 500);',
                '    }, [onDone]);',
                '};',
                ''
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useDelay = (onDone: () => void): void => {',
                '    useEffect(() => {',
                '        const id = setTimeout(onDone, 500);',
                '        return () => clearTimeout(id);',
                '    }, [onDone]);',
                '};',
                ''
            ]
        }
    ];

    const found = async (lines, rule) => {
        const config = await eslint.calculateConfigForFile(SOURCE_FILE);

        // A rule the config leaves off reports nothing, which must never read as a pass.
        assert.ok(config.rules?.[rule], `${rule} must be configured`);

        const [result] = await eslint.lintText(lines.join('\n'), { filePath: SOURCE_FILE });

        assert.deepEqual(
            result.messages.filter(({ fatal }) => fatal),
            [],
            'the snippet must parse'
        );

        return result.messages.filter(({ ruleId }) => ruleId === rule);
    };

    for (const { rule, leaking, released } of CASES) {
        it(`${rule} is an error`, async () => {
            const config = await eslint.calculateConfigForFile(SOURCE_FILE);

            assert.equal(config.rules?.[rule]?.[0], ERROR_SEVERITY);
        });

        it(`${rule} flags an effect that never releases it`, async () => {
            assert.equal((await found(leaking, rule)).length, 1);
        });

        it(`${rule} accepts the effect that returns the cleanup`, async () => {
            assert.deepEqual(await found(released, rule), []);
        });
    }
});

describe('state derived from other state is computed during render', () => {
    const RULE = 'react-hooks/set-state-in-effect';
    const DERIVED_FILE = 'src/hooks/useStoreReady.ts';

    const derived = async (lines) => {
        const config = await eslint.calculateConfigForFile(DERIVED_FILE);

        assert.ok(config.rules?.[RULE], `${RULE} must be configured`);

        const [result] = await eslint.lintText(lines.join('\n'), { filePath: DERIVED_FILE });

        assert.deepEqual(
            result.messages.filter(({ fatal }) => fatal),
            [],
            'the snippet must parse'
        );

        return result.messages.filter(({ ruleId }) => ruleId === RULE);
    };

    // Covered by the rule the config already has: no second plugin is needed for this form.
    it('flags a state value that an effect rebuilds from other values', async () => {
        const found = await derived([
            "import { useEffect, useState } from 'react';",
            'export const useFullName = (first: string, last: string): string => {',
            "    const [full, setFull] = useState('');",
            '    useEffect(() => {',
            "        setFull(first + ' ' + last);",
            '    }, [first, last]);',
            '    return full;',
            '};',
            ''
        ]);

        assert.equal(found.length, 1);
    });

    it('accepts the value computed while rendering', async () => {
        const found = await derived([
            "export const useFullName = (first: string, last: string): string => first + ' ' + last;",
            ''
        ]);

        assert.deepEqual(found, []);
    });

    // Known gap, recorded as a test so a later rule that closes it turns this case red on purpose:
    // a state copy of a prop with no effect at all is something no rule of the config reports.
    it('reports a state copy of a prop that has no effect under no rule (known gap)', async () => {
        const [result] = await eslint.lintText(
            [
                "import { useState } from 'react';",
                'export const useCopy = (props: { value: string }): string => {',
                '    const [value] = useState(props.value);',
                '    return value;',
                '};',
                ''
            ].join('\n'),
            { filePath: DERIVED_FILE }
        );

        assert.deepEqual(
            result.messages.filter(({ fatal }) => fatal),
            [],
            'the snippet must parse'
        );
        assert.deepEqual(result.messages, [], 'no rule of the config reports the copy');
    });
});
