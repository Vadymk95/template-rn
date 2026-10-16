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
