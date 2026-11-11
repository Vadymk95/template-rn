// The iterate chain's format leg. `format:check` ran first at the commit hook, so a formatting drift
// cost a failed commit. The leg checks the files the working tree changed (the same set the ESLint leg
// lints: `changedFiles` in lint-changed.mjs) with the flags and the cache of `npm run format:check`.
//
// The decision (which arguments) is pure; the CLI cases run the real script against a throwaway git
// repository, because the exit status has to be Prettier's and an ignored or unknown file must stay quiet.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { prettierArgs } from './format-changed.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'format-changed.mjs');
const GIT_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

// A suite that runs inside a git hook inherits the hook's repository variables; every child starts clean.
const cleanEnv = () => {
    const env = { ...process.env, CI: '', GITHUB_ACTIONS: '' };
    for (const key of GIT_VARIABLES) delete env[key];
    return env;
};

const git = (cwd, args) =>
    execFileSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8', stdio: 'pipe' });

const FORMATTED = 'export const value = 1;\n';
const UNFORMATTED = 'export   const value   =   1\n';

describe('prettierArgs', () => {
    it('checks, shares the cache of format:check, skips unknown types, and puts paths after `--`', () => {
        const args = prettierArgs(['a.ts', '-odd.ts']);

        assert.deepEqual(args.slice(0, args.indexOf('--')), [
            '--check',
            '--cache',
            '--cache-location',
            '.prettiercache',
            '--ignore-unknown',
            '--no-error-on-unmatched-pattern'
        ]);
        assert.deepEqual(args.slice(args.indexOf('--') + 1), ['a.ts', '-odd.ts']);
    });
});

// The CLI cases start node and Prettier; the full suite runs them next to dozens of other files, so
// the default limit is a machine-load measurement, not a property of the script.
describe('the CLI against a real git repository', { timeout: 30_000 }, () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const write = (root, file, text = FORMATTED) => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    // A repository whose first commit holds the repository's Prettier options, an ignore file and a
    // formatted file; `committed-drift.mjs` is committed UNFORMATTED on purpose.
    const makeRepo = () => {
        const root = mkdtempSync(path.join(tmpdir(), 'format-changed-'));
        roots.push(root);
        git(root, ['init', '--quiet', '--initial-branch=main']);
        git(root, ['config', 'user.email', 'gate@example.invalid']);
        git(root, ['config', 'user.name', 'gate']);
        git(root, ['config', 'commit.gpgsign', 'false']);
        write(root, '.prettierrc.json', JSON.stringify({ singleQuote: true, tabWidth: 4 }));
        write(root, '.prettierignore', 'scratch/\n');
        write(root, 'kept.mjs');
        write(root, 'committed-drift.mjs', UNFORMATTED);
        git(root, ['add', '-A']);
        git(root, ['commit', '--quiet', '--no-verify', '-m', 'baseline']);
        return root;
    };

    const run = (root) =>
        spawnSync(process.execPath, [SCRIPT], { cwd: root, env: cleanEnv(), encoding: 'utf8' });

    it('passes on a clean tree without starting Prettier', () => {
        const root = makeRepo();
        // A Prettier config that cannot parse proves Prettier is never started.
        write(root, '.prettierrc.json', '{ not json');
        git(root, ['add', '-A']);
        git(root, ['commit', '--quiet', '--no-verify', '-m', 'break the config']);

        const result = run(root);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /no changed file/);
    });

    it('refuses an untracked file that is not formatted, and names it', () => {
        const root = makeRepo();
        write(root, 'fresh.mjs', UNFORMATTED);

        const result = run(root);

        assert.equal(result.status, 1);
        assert.match(`${result.stdout}${result.stderr}`, /fresh\.mjs/);
        assert.match(result.stderr, /npm run fix/);
    });

    it('refuses an unstaged edit of a tracked file that is not formatted', () => {
        const root = makeRepo();
        write(root, 'kept.mjs', UNFORMATTED);

        assert.equal(run(root).status, 1);
    });

    it('refuses a staged file that is not formatted', () => {
        const root = makeRepo();
        write(root, 'staged.mjs', UNFORMATTED);
        git(root, ['add', 'staged.mjs']);

        assert.equal(run(root).status, 1);
    });

    it('passes a changed file that is formatted', () => {
        const root = makeRepo();
        write(root, 'kept.mjs', 'export const value = 2;\n');

        assert.equal(run(root).status, 0);
    });

    it('leaves an unformatted file alone when it is not among the changed ones', () => {
        const root = makeRepo();
        write(root, 'kept.mjs', 'export const value = 2;\n');

        const result = run(root);

        assert.equal(result.status, 0);
        assert.doesNotMatch(`${result.stdout}${result.stderr}`, /committed-drift\.mjs/);
    });

    it('passes a changed file that Prettier ignores, however unformatted', () => {
        const root = makeRepo();
        write(root, 'scratch/probe.mjs', UNFORMATTED);

        assert.equal(run(root).status, 0);
    });

    it('passes a changed file of a type Prettier cannot parse', () => {
        const root = makeRepo();
        write(root, 'data.unknownext', 'anything   goes\n');

        assert.equal(run(root).status, 0);
    });

    it('passes when the only change is a deletion', () => {
        const root = makeRepo();
        unlinkSync(path.join(root, 'kept.mjs'));

        assert.equal(run(root).status, 0);
    });
});
