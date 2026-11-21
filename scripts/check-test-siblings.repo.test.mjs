// The exemption list is the part of the sibling gate people actually edit, and every edit widens it,
// usually to get one commit moving. This repository's list is `siblings.exempt` in
// scripts/gate-tiers.json; these cases read that real list and pin what the exemptions are FOR, so a
// widening that changes the policy fails here instead of silently letting untested logic land.
// The cases that run the script over fixture repositories and fixture lists live in gatelaw.
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { findMissingSiblings, isSrcLogic, readPolicy } from './check-test-siblings.mjs';

const { after, describe, it } = globalThis.describe ? globalThis : await import('node:test');

const loaded = readPolicy(process.cwd());
/** The policy of this repository; a file the script cannot read fails the case that asks for it. */
const policy = () => {
    if (loaded.error !== undefined) throw new Error(loaded.error);
    return loaded.policy;
};

const nothingExists = () => false;

describe('isSrcLogic', () => {
    for (const file of [
        'src/lib/utils.ts',
        'src/lib/secureToken.ts',
        'src/hooks/useStoreReady.ts',
        'src/store/todo/todoStore.ts',
        'src/features/todo/useTodoWorkspace.ts',
        'src/widgets/todo-workspace/TodoList.tsx',
        'src/shared/ui/Card/Card.tsx'
    ]) {
        it(`treats ${file} as logic that needs a test`, () => {
            assert.equal(isSrcLogic(file, policy()), true);
        });
    }

    for (const [label, file] of [
        ['a test file', 'src/lib/utils.test.ts'],
        ['a type declaration', 'src/types/global.d.ts'],
        ['a barrel', 'src/features/todo/index.ts'],
        ['a constants table', 'src/store/todo/constants.ts'],
        ['a types-only module', 'src/features/todo/types.ts'],
        ['a storage-key registry', 'src/lib/storageKeys.ts'],
        ['validated env', 'src/env.ts'],
        ['a storybook story', 'src/shared/ui/Card/Card.stories.tsx'],
        ['a template seed', 'src/lib/api/_exampleSafeQuery.ts'],
        // Expo Router shells and infrastructure, all excluded from coverage too.
        ['a router screen', 'src/app/(tabs)/index.tsx'],
        ['the root layout', 'src/app/_layout.tsx'],
        ['test setup', 'src/test/setup.ts'],
        ['a declarative constants table', 'src/shared/lib/constants/routes.ts'],
        ['i18n bootstrap glue', 'src/shared/lib/i18n/index.ts'],
        ['a locale bundle module', 'src/shared/locales/en/common.ts']
    ]) {
        it(`exempts ${label}`, () => {
            assert.equal(isSrcLogic(file, policy()), false);
        });
    }

    it('does NOT exempt the theme token modules', () => {
        // Deliberate: they are in the coverage report and `colors.ts` exports a real
        // function. Adding `^src/shared/lib/theme/` to the exempt list to move a commit along
        // is exactly what this case is here to stop.
        assert.equal(isSrcLogic('src/shared/lib/theme/colors.ts', policy()), true);
        assert.equal(isSrcLogic('src/shared/lib/theme/spacing.ts', policy()), true);
    });

    it('ignores files outside src entirely', () => {
        assert.equal(isSrcLogic('scripts/audit-gate.mjs', policy()), false);
        assert.equal(isSrcLogic('app.config.ts', policy()), false);
        assert.equal(isSrcLogic('metro.config.js', policy()), false);
    });

    it('ignores non-TypeScript files under src', () => {
        assert.equal(isSrcLogic('src/shared/locales/en/common.json', policy()), false);
    });

    it('does not exempt a nested directory that reuses an exempt name', () => {
        // Every `^src/...` exemption is anchored on purpose. Each path below contains
        // the segment somewhere OTHER than the start, which is what makes these cases
        // catch an un-anchoring.
        assert.equal(isSrcLogic('src/features/editor/app/Screen.tsx', policy()), true);
        assert.equal(isSrcLogic('src/features/editor/test/helpers.ts', policy()), true);
        assert.equal(
            isSrcLogic('src/features/editor/shared/lib/constants/local.ts', policy()),
            true
        );
        assert.equal(isSrcLogic('src/features/editor/shared/lib/i18n/keys.ts', policy()), true);
        assert.equal(isSrcLogic('src/features/editor/shared/locales/en.ts', policy()), true);
    });

    it('does not exempt a filename that merely starts with an exempt name', () => {
        assert.equal(isSrcLogic('src/lib/constantsFactory.ts', policy()), true);
        assert.equal(isSrcLogic('src/features/todo/typesGuard.ts', policy()), true);
        assert.equal(isSrcLogic('src/lib/storageKeysMigration.ts', policy()), true);
    });
});

describe('findMissingSiblings', () => {
    it('never reports an exempt file, even with nothing on disk', () => {
        assert.deepEqual(findMissingSiblings(['src/app/_layout.tsx'], nothingExists, policy()), []);
    });

    it('reports every offender rather than stopping at the first', () => {
        assert.deepEqual(
            findMissingSiblings(
                ['src/lib/a.ts', 'src/app/_layout.tsx', 'src/lib/b.ts'],
                nothingExists,
                policy()
            ),
            ['src/lib/a.ts', 'src/lib/b.ts']
        );
    });
});

// The command line over a temporary repository that carries this repository's real `siblings` key: the
// two cases that name paths of this layout. The rest of the command line is tested in gatelaw.
describe('the CLI against a real git repository', () => {
    const SCRIPT = path.resolve(process.cwd(), 'scripts/check-test-siblings.mjs');
    const POLICY_FILE = readFileSync(
        path.resolve(process.cwd(), 'scripts/gate-tiers.json'),
        'utf8'
    );
    const roots = [];

    // A suite run from inside a git hook inherits GIT_DIR and GIT_WORK_TREE; a child git that keeps
    // them answers for the hook's repository instead of the temporary one under test.
    const cleanEnv = () => {
        const clean = { ...process.env };
        for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) {
            delete clean[key];
        }
        return clean;
    };

    const git = (cwd, ...args) =>
        execFileSync(
            'git',
            [
                '-c',
                'user.name=gate-test',
                '-c',
                'user.email=gate-test@example.com',
                '-c',
                'commit.gpgsign=false',
                '-c',
                'core.hooksPath=/dev/null',
                ...args
            ],
            { cwd, env: cleanEnv(), encoding: 'utf8', stdio: 'pipe' }
        );

    const write = (root, file, text = 'export const value = 1;\n') => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    const commitAll = (root, message) => {
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', message);
        return git(root, 'rev-parse', 'HEAD').trim();
    };

    /** A repository with no commit yet, carrying this repository's `scripts/gate-tiers.json`. */
    const initRepo = (prefix) => {
        const root = mkdtempSync(path.join(tmpdir(), prefix));
        roots.push(root);
        git(root, 'init', '-q', '-b', 'master');
        write(root, 'scripts/gate-tiers.json', POLICY_FILE);
        return root;
    };

    const run = (cwd, args) =>
        spawnSync(process.execPath, [SCRIPT, ...args], {
            cwd,
            env: { ...cleanEnv(), CI: '', GITHUB_ACTIONS: '' },
            encoding: 'utf8'
        });

    after(() => {
        for (const root of roots) {
            rmSync(root, { recursive: true, force: true });
        }
    });

    describe('range mode reads the head tree', () => {
        it('ignores exempt files, deleted files and files outside src', () => {
            const root = initRepo('siblings-range-');
            write(root, 'README.md', 'seed\n');
            commitAll(root, 'seed');
            write(root, 'src/lib/doomed.ts');
            write(root, 'src/lib/doomed.test.ts');
            const base = commitAll(root, 'add doomed');
            write(root, 'src/app/_layout.tsx');
            write(root, 'scripts/tool.mjs');
            git(root, 'rm', '-q', 'src/lib/doomed.ts', 'src/lib/doomed.test.ts');
            commitAll(root, 'exempt, outside, deleted');

            assert.equal(run(root, ['--range', '--base', base]).status, 0);
        });
    });

    describe('changed mode', () => {
        it('applies the exempt list of the commit hook', () => {
            const root = initRepo('siblings-changed-');
            write(root, 'src/lib/ok.ts');
            write(root, 'src/lib/ok.test.ts');
            write(root, 'src/lib/legacy.ts');
            commitAll(root, 'base');
            write(root, 'src/shared/lib/constants/routes.ts');
            write(root, 'src/features/todo/index.ts');
            write(root, 'src/app/_layout.tsx');
            write(root, 'src/types/global.d.ts');
            write(root, 'src/lib/api/_exampleQuery.ts');

            assert.equal(run(root, ['--changed']).status, 0);
        });
    });
});
