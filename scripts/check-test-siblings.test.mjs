// The EXEMPT list is the part of this gate people actually edit, and every edit
// widens it — usually to get one commit moving. These cases pin what the exemptions
// are FOR, so a widening that changes the policy fails here instead of silently
// letting untested logic land.
//
// Runner: `node:test`, for the same reason as the other gate specs here — Jest 29
// neither discovers `.mjs` nor loads real ESM without --experimental-vm-modules, and
// keeping these out of `collectCoverageFrom` stops gate tooling from moving the app's
// coverage thresholds. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { findMissingSiblings, isSrcLogic } from './check-test-siblings.mjs';

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
            assert.equal(isSrcLogic(file), true);
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
            assert.equal(isSrcLogic(file), false);
        });
    }

    it('does NOT exempt the theme token modules', () => {
        // Deliberate: they are in the coverage report and `colors.ts` exports a real
        // function. Adding `^src/shared/lib/theme/` to EXEMPT to move a commit along
        // is exactly what this case is here to stop.
        assert.equal(isSrcLogic('src/shared/lib/theme/colors.ts'), true);
        assert.equal(isSrcLogic('src/shared/lib/theme/spacing.ts'), true);
    });

    it('ignores files outside src entirely', () => {
        assert.equal(isSrcLogic('scripts/audit-gate.mjs'), false);
        assert.equal(isSrcLogic('app.config.ts'), false);
        assert.equal(isSrcLogic('metro.config.js'), false);
    });

    it('ignores non-TypeScript files under src', () => {
        assert.equal(isSrcLogic('src/shared/locales/en/common.json'), false);
    });

    it('does not exempt a nested directory that reuses an exempt name', () => {
        // Every `^src/...` exemption is anchored on purpose. Each path below contains
        // the segment somewhere OTHER than the start, which is what makes these cases
        // catch an un-anchoring.
        assert.equal(isSrcLogic('src/features/editor/app/Screen.tsx'), true);
        assert.equal(isSrcLogic('src/features/editor/test/helpers.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/lib/constants/local.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/lib/i18n/keys.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/locales/en.ts'), true);
    });

    it('does not exempt a filename that merely starts with an exempt name', () => {
        assert.equal(isSrcLogic('src/lib/constantsFactory.ts'), true);
        assert.equal(isSrcLogic('src/features/todo/typesGuard.ts'), true);
        assert.equal(isSrcLogic('src/lib/storageKeysMigration.ts'), true);
    });
});

describe('findMissingSiblings', () => {
    it('reports a logic file with no sibling', () => {
        assert.deepEqual(findMissingSiblings(['src/lib/utils.ts'], nothingExists), [
            'src/lib/utils.ts'
        ]);
    });

    it('accepts a .ts file covered by a .test.ts sibling', () => {
        const exists = (path) => path === 'src/lib/utils.test.ts';

        assert.deepEqual(findMissingSiblings(['src/lib/utils.ts'], exists), []);
    });

    it('accepts a .tsx file covered by a .test.tsx sibling', () => {
        const exists = (path) => path === 'src/shared/ui/Card/Card.test.tsx';

        assert.deepEqual(findMissingSiblings(['src/shared/ui/Card/Card.tsx'], exists), []);
    });

    it('passes an empty change set', () => {
        assert.deepEqual(findMissingSiblings([], nothingExists), []);
    });

    it('never reports an exempt file, even with nothing on disk', () => {
        assert.deepEqual(findMissingSiblings(['src/app/_layout.tsx'], nothingExists), []);
    });

    it('reports every offender rather than stopping at the first', () => {
        assert.deepEqual(
            findMissingSiblings(
                ['src/lib/a.ts', 'src/app/_layout.tsx', 'src/lib/b.ts'],
                nothingExists
            ),
            ['src/lib/a.ts', 'src/lib/b.ts']
        );
    });

    it('probes only paths derived from the file under test', () => {
        const probed = [];
        findMissingSiblings(['src/store/todo/todoStore.ts'], (path) => {
            probed.push(path);
            return false;
        });

        assert.deepEqual(probed, [
            'src/store/todo/todoStore.test.ts',
            'src/store/todo/todoStore.test.tsx'
        ]);
    });

    it('is not satisfied by a sibling belonging to a different module', () => {
        assert.deepEqual(
            findMissingSiblings(['src/lib/a.ts'], (path) => path.includes('b.test')),
            ['src/lib/a.ts']
        );
    });
});

/* ------------------------------------------------------------------------ the CLI, end to end */

// The gate used to ask the DISK whether a sibling exists. The disk holds files the commit does not:
// an untracked test satisfied a pre-commit that then committed no test at all, and nothing but the
// pre-commit hook ever looked, so a skipped hook (or a PR from a fork) landed an orphan unchecked.
// Staged mode now asks the git index and range mode asks the head tree; both are driven here
// through real repositories, because the bug lived in what git was asked and not in a pure function.
describe('the CLI against a real git repository', () => {
    const SCRIPT = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'check-test-siblings.mjs'
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

    // `extra` is merged over the clean environment, for the one case that needs GIT_INDEX_FILE.
    const gitWith = (cwd, extra, ...args) =>
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
            { cwd, env: { ...cleanEnv(), ...extra }, encoding: 'utf8', stdio: 'pipe' }
        );

    const git = (cwd, ...args) => gitWith(cwd, {}, ...args);

    const makeRepo = () => {
        const root = mkdtempSync(path.join(tmpdir(), 'siblings-'));
        roots.push(root);
        git(root, 'init', '-q', '-b', 'master');
        write(root, 'README.md', 'seed\n');
        commitAll(root, 'seed');
        return root;
    };

    const write = (root, file, text = 'export const value = 1;\n') => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    const commitAll = (root, message) => {
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', message);
        return git(root, 'rev-parse', 'HEAD').trim();
    };

    const run = (cwd, args = [], env = {}) =>
        spawnSync(process.execPath, [SCRIPT, ...args], {
            cwd,
            env: { ...cleanEnv(), CI: '', GITHUB_ACTIONS: '', ...env },
            encoding: 'utf8'
        });

    after(() => {
        for (const root of roots) {
            rmSync(root, { recursive: true, force: true });
        }
    });

    describe('staged mode reads the git index', () => {
        it('fails when the sibling test exists only as an untracked file', () => {
            const root = makeRepo();
            write(root, 'src/lib/untested.ts');
            write(root, 'src/lib/untested.test.ts');
            git(root, 'add', 'src/lib/untested.ts');

            const result = run(root);

            assert.equal(result.status, 1);
            assert.match(result.stderr, /src\/lib\/untested\.ts/);
        });

        it('passes when the sibling is staged with the source', () => {
            const root = makeRepo();
            write(root, 'src/lib/tested.ts');
            write(root, 'src/lib/tested.test.ts');
            git(root, 'add', 'src/lib/tested.ts', 'src/lib/tested.test.ts');

            assert.equal(run(root).status, 0);
        });

        it('passes when the sibling is already committed and only the source changes', () => {
            const root = makeRepo();
            write(root, 'src/lib/tested.ts');
            write(root, 'src/lib/tested.test.ts');
            commitAll(root, 'add tested');
            write(root, 'src/lib/tested.ts', 'export const value = 2;\n');
            git(root, 'add', 'src/lib/tested.ts');

            assert.equal(run(root).status, 0);
        });

        it('fails when the commit removes the sibling from the index', () => {
            const root = makeRepo();
            write(root, 'src/lib/tested.ts');
            write(root, 'src/lib/tested.test.ts');
            commitAll(root, 'add tested');
            write(root, 'src/lib/tested.ts', 'export const value = 2;\n');
            git(root, 'add', 'src/lib/tested.ts');
            git(root, 'rm', '-q', '--cached', 'src/lib/tested.test.ts');

            const result = run(root);

            assert.equal(result.status, 1);
            assert.match(result.stderr, /src\/lib\/tested\.ts/);
        });

        it('lets a source file and its sibling be deleted together', () => {
            const root = makeRepo();
            write(root, 'src/lib/gone.ts');
            write(root, 'src/lib/gone.test.ts');
            commitAll(root, 'add gone');
            git(root, 'rm', '-q', 'src/lib/gone.ts', 'src/lib/gone.test.ts');

            assert.equal(run(root).status, 0);
        });

        it('answers for the repository it runs in, not for an inherited GIT_DIR', () => {
            const root = makeRepo();
            write(root, 'src/lib/untested.ts');
            git(root, 'add', 'src/lib/untested.ts');
            const decoy = mkdtempSync(path.join(tmpdir(), 'siblings-decoy-'));
            roots.push(decoy);
            git(decoy, 'init', '-q', '-b', 'master');

            const result = run(root, [], {
                GIT_DIR: path.join(decoy, '.git'),
                GIT_WORK_TREE: decoy
            });

            assert.equal(result.status, 1);
        });

        it('reads the index a partial commit hands its hook, not the default one', () => {
            // `git commit -- <path>` runs the hook with GIT_INDEX_FILE naming a temporary index that
            // holds only what that commit will contain; the default index is not what lands.
            const root = makeRepo();
            write(root, 'src/lib/partial.ts');
            write(root, 'src/lib/partial.test.ts');
            git(root, 'add', 'src/lib/partial.test.ts');
            const temporary = path.join(root, '.git', 'hook-index');
            const env = { GIT_INDEX_FILE: temporary };
            gitWith(root, env, 'read-tree', 'HEAD');
            gitWith(root, env, 'add', 'src/lib/partial.ts');

            // The default index holds only the test, so only the temporary index can make this fail.
            assert.equal(run(root).status, 0);
            const result = run(root, [], env);

            assert.equal(result.status, 1);
            assert.match(result.stderr, /src\/lib\/partial\.ts/);
        });

        it('refuses a real partial commit whose source leaves its staged test behind', () => {
            const root = makeRepo();
            write(root, 'src/lib/a.ts');
            write(root, 'src/lib/a.test.ts');
            git(root, 'add', '-A');
            const hooks = path.join(root, '.git', 'hooks');
            writeFileSync(
                path.join(hooks, 'pre-commit'),
                `#!/bin/sh\nexec "${process.execPath}" "${SCRIPT}"\n`,
                { mode: 0o755 }
            );
            const commitOnly = (...files) =>
                git(
                    root,
                    '-c',
                    `core.hooksPath=${hooks}`,
                    'commit',
                    '-q',
                    '-m',
                    'partial',
                    '--',
                    ...files
                );
            const countCommits = () => Number(git(root, 'rev-list', '--count', 'HEAD'));

            // The source alone leaves its test out of the commit, so the hook has to refuse it.
            assert.throws(() => commitOnly('src/lib/a.ts'));
            assert.equal(countCommits(), 1);

            // With the test in the same partial commit the hook runs and lets it through.
            commitOnly('src/lib/a.ts', 'src/lib/a.test.ts');
            assert.equal(countCommits(), 2);
        });

        it('still checks explicit files against the disk', () => {
            const root = makeRepo();
            write(root, 'src/lib/a.ts');
            write(root, 'src/lib/b.ts');
            write(root, 'src/lib/b.test.ts');

            assert.equal(run(root, ['src/lib/a.ts']).status, 1);
            assert.equal(run(root, ['src/lib/b.ts']).status, 0);
        });
    });

    describe('range mode reads the head tree', () => {
        it('fails on an orphan source file added in the range', () => {
            const root = makeRepo();
            const base = git(root, 'rev-parse', 'HEAD').trim();
            write(root, 'src/lib/orphan.ts');
            commitAll(root, 'add orphan');

            const result = run(root, ['--range', '--base', base]);

            assert.equal(result.status, 1);
            assert.match(result.stderr, /src\/lib\/orphan\.ts/);
        });

        it('passes when the source and its sibling arrive in the range together', () => {
            const root = makeRepo();
            const base = git(root, 'rev-parse', 'HEAD').trim();
            write(root, 'src/lib/tested.ts');
            write(root, 'src/lib/tested.test.ts');
            commitAll(root, 'add tested');

            assert.equal(run(root, ['--range', '--base', base]).status, 0);
        });

        it('is not satisfied by a sibling that is only on the disk', () => {
            const root = makeRepo();
            const base = git(root, 'rev-parse', 'HEAD').trim();
            write(root, 'src/lib/orphan.ts');
            commitAll(root, 'add orphan');
            write(root, 'src/lib/orphan.test.ts');

            assert.equal(run(root, ['--range', '--base', base]).status, 1);
        });

        it('fails when the range changes a source file and deletes its sibling', () => {
            const root = makeRepo();
            write(root, 'src/lib/tested.ts');
            write(root, 'src/lib/tested.test.ts');
            const base = commitAll(root, 'add tested');
            write(root, 'src/lib/tested.ts', 'export const value = 2;\n');
            git(root, 'rm', '-q', 'src/lib/tested.test.ts');
            commitAll(root, 'edit source, drop test');

            const result = run(root, ['--range', '--base', base]);

            assert.equal(result.status, 1);
            assert.match(result.stderr, /src\/lib\/tested\.ts/);
        });

        it('ignores exempt files, deleted files and files outside src', () => {
            const root = makeRepo();
            write(root, 'src/lib/doomed.ts');
            write(root, 'src/lib/doomed.test.ts');
            const base = commitAll(root, 'add doomed');
            write(root, 'src/app/_layout.tsx');
            write(root, 'scripts/tool.mjs');
            git(root, 'rm', '-q', 'src/lib/doomed.ts', 'src/lib/doomed.test.ts');
            commitAll(root, 'exempt, outside, deleted');

            assert.equal(run(root, ['--range', '--base', base]).status, 0);
        });

        it('judges only what the range changed', () => {
            const root = makeRepo();
            write(root, 'src/lib/legacy.ts');
            const base = commitAll(root, 'legacy file without a test');
            write(root, 'docs.md', 'text\n');
            commitAll(root, 'unrelated change');

            assert.equal(run(root, ['--range', '--base', base]).status, 0);
        });

        it('compares with the first parent when CI is set', () => {
            const root = makeRepo();
            write(root, 'src/lib/orphan.ts');
            commitAll(root, 'add orphan');

            assert.equal(run(root, ['--range'], { CI: 'true' }).status, 1);
        });

        it('compares with the merge base of origin/master on a developer machine', () => {
            const root = makeRepo();
            git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
            write(root, 'src/lib/first.ts');
            write(root, 'src/lib/first.test.ts');
            commitAll(root, 'first, tested');
            write(root, 'src/lib/second.ts');
            commitAll(root, 'second, orphan');
            write(root, 'src/lib/second.test.ts');
            git(root, 'add', '-A');
            git(root, 'commit', '-q', '-m', 'test lands later in the same push');

            assert.equal(run(root, ['--range']).status, 0);
        });

        it('reports an orphan from an earlier commit of the same push', () => {
            const root = makeRepo();
            git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
            write(root, 'src/lib/orphan.ts');
            commitAll(root, 'orphan');
            write(root, 'docs.md', 'text\n');
            commitAll(root, 'unrelated, on top');

            assert.equal(run(root, ['--range']).status, 1);
        });

        it('refuses a base that is not a commit rather than passing', () => {
            const root = makeRepo();

            const result = run(root, ['--range', '--base', 'no-such-ref']);

            assert.equal(result.status, 2);
            assert.match(result.stderr, /no-such-ref/);
        });

        it('refuses a shallow clone that hides the parent rather than passing', () => {
            const origin = makeRepo();
            write(origin, 'src/lib/orphan.ts');
            commitAll(origin, 'add orphan');
            const clone = mkdtempSync(path.join(tmpdir(), 'siblings-shallow-'));
            roots.push(clone);
            git(clone, 'clone', '-q', '--depth', '1', `file://${origin}`, '.');

            const result = run(clone, ['--range'], { CI: 'true' });

            assert.equal(result.status, 2);
            assert.match(result.stderr, /fetch-depth/);
        });

        // A fork made with "Use this template" starts as ONE commit holding the whole template,
        // including logic files that predate this gate. Failing its first CI run would hand every
        // new project a red pipeline for code it did not write; the ratchet starts at the next change.
        it('passes with a note on the first commit of a repository, which has nothing to compare with', () => {
            const root = mkdtempSync(path.join(tmpdir(), 'siblings-root-'));
            roots.push(root);
            git(root, 'init', '-q', '-b', 'master');
            write(root, 'src/lib/legacy.ts');
            commitAll(root, 'first commit');

            const result = run(root, ['--range']);

            assert.equal(result.status, 0);
            assert.match(result.stdout, /first commit/);
        });

        it('rejects an unknown option', () => {
            const root = makeRepo();

            assert.equal(run(root, ['--rangee']).status, 2);
        });
    });
});
