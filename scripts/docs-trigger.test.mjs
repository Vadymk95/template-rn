// `docs:check` runs at two moments, the commit hook (staged files) and the iterate chain (the working
// tree against HEAD), and the condition for running it is one regular expression in docs-trigger.mjs.
// A second copy of that pattern in a hook or a package script would drift, so the last cases read the
// hook and package.json as text and fail when either stops going through the script.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    unlinkSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { touchesDocs } from './docs-trigger.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs-trigger.mjs');
const GIT_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

// A suite that runs inside a git hook inherits the hook's repository variables; every child starts clean.
const cleanEnv = () => {
    const env = { ...process.env, CI: '', GITHUB_ACTIONS: '' };
    for (const key of GIT_VARIABLES) delete env[key];
    return env;
};

const git = (cwd, args) =>
    execFileSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8', stdio: 'pipe' });

describe('touchesDocs', () => {
    for (const file of [
        'README.md',
        '.cursor/rules/global.mdc',
        '.cursor/brain/MAP.md',
        '.github/workflows/ci.yml',
        '.husky/pre-commit',
        'scripts/gate-tiers.json',
        'scripts/docs-check.mjs',
        'scripts/docs-check.test.mjs',
        'package.json'
    ]) {
        it(`runs for ${file}`, () => {
            assert.equal(touchesDocs([file]), true);
        });
    }

    for (const file of [
        'src/app/(tabs)/index.tsx',
        'src/shared/lib/utils.ts',
        'scripts/check-test-siblings.mjs',
        'app.config.ts',
        'src/shared/locales/en/common.json',
        'docs-check.md.bak'
    ]) {
        it(`does not run for ${file}`, () => {
            assert.equal(touchesDocs([file]), false);
        });
    }

    it('runs when any one file of the set matches', () => {
        assert.equal(touchesDocs(['src/shared/lib/utils.ts', 'notes/plan.md']), true);
    });

    it('does not run for an empty set', () => {
        assert.equal(touchesDocs([]), false);
    });
});

describe('the CLI against a real git repository', { timeout: 30_000 }, () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const write = (root, file, text = 'x\n') => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    // `docs:check` in the fixture leaves a marker and exits with the code in the `DOCS_EXIT` variable.
    const makeRepo = () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docs-trigger-'));
        roots.push(root);
        git(root, ['init', '--quiet', '--initial-branch=main']);
        git(root, ['config', 'user.email', 'gate@example.invalid']);
        git(root, ['config', 'user.name', 'gate']);
        git(root, ['config', 'commit.gpgsign', 'false']);
        write(
            root,
            'package.json',
            JSON.stringify({
                name: 'docs-trigger-fixture',
                version: '0.0.0',
                scripts: {
                    'docs:check':
                        "node -e \"require('node:fs').writeFileSync('docs-ran','1');process.exit(Number(process.env.DOCS_EXIT||0))\""
                }
            })
        );
        write(root, 'README.md');
        write(root, 'src/lib/a.ts');
        git(root, ['add', '-A']);
        git(root, ['commit', '--quiet', '--no-verify', '-m', 'baseline']);
        return root;
    };

    const run = (root, args = [], extra = {}) =>
        spawnSync(process.execPath, [SCRIPT, ...args], {
            cwd: root,
            env: { ...cleanEnv(), ...extra },
            encoding: 'utf8'
        });
    const ran = (root) => existsSync(path.join(root, 'docs-ran'));

    describe('changed mode (the working tree against HEAD)', () => {
        it('runs docs:check for a changed markdown file', () => {
            const root = makeRepo();
            write(root, 'README.md', 'changed\n');

            assert.equal(run(root).status, 0);
            assert.equal(ran(root), true);
        });

        it('runs docs:check for an untracked markdown file', () => {
            const root = makeRepo();
            write(root, 'notes/new.md');

            assert.equal(run(root).status, 0);
            assert.equal(ran(root), true);
        });

        it('runs docs:check for a deleted markdown file, as the commit hook does', () => {
            const root = makeRepo();
            unlinkSync(path.join(root, 'README.md'));

            assert.equal(run(root).status, 0);
            assert.equal(ran(root), true);
        });

        it('does not run docs:check for a change only under src', () => {
            const root = makeRepo();
            write(root, 'src/lib/a.ts', 'export {};\n');

            const result = run(root);

            assert.equal(result.status, 0);
            assert.equal(ran(root), false);
            assert.match(result.stdout, /skipped/);
        });

        it('does not run docs:check on a clean tree', () => {
            const root = makeRepo();

            assert.equal(run(root).status, 0);
            assert.equal(ran(root), false);
        });

        it('fails with the status of docs:check', () => {
            const root = makeRepo();
            write(root, 'README.md', 'changed\n');

            assert.equal(run(root, [], { DOCS_EXIT: '3' }).status, 3);
        });
    });

    describe('--staged (the commit hook)', () => {
        it('runs docs:check for a staged markdown file', () => {
            const root = makeRepo();
            write(root, 'README.md', 'changed\n');
            git(root, ['add', 'README.md']);

            assert.equal(run(root, ['--staged']).status, 0);
            assert.equal(ran(root), true);
        });

        it('does not run docs:check for a markdown file that is changed but not staged', () => {
            const root = makeRepo();
            write(root, 'README.md', 'changed\n');
            write(root, 'src/lib/a.ts', 'export {};\n');
            git(root, ['add', 'src/lib/a.ts']);

            assert.equal(run(root, ['--staged']).status, 0);
            assert.equal(ran(root), false);
        });

        it('runs docs:check for a staged deletion', () => {
            const root = makeRepo();
            git(root, ['rm', '--quiet', 'README.md']);

            assert.equal(run(root, ['--staged']).status, 0);
            assert.equal(ran(root), true);
        });

        it('fails with the status of docs:check', () => {
            const root = makeRepo();
            write(root, 'README.md', 'changed\n');
            git(root, ['add', 'README.md']);

            assert.equal(run(root, ['--staged'], { DOCS_EXIT: '4' }).status, 4);
        });
    });

    it('refuses an option it does not know, instead of skipping the check', () => {
        const root = makeRepo();

        const result = run(root, ['--stagd']);

        assert.equal(result.status, 1);
        assert.equal(ran(root), false);
    });
});

describe('one condition, read by the hook and by the iterate chain', () => {
    const hook = readFileSync('.husky/pre-commit', 'utf8');
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
    const iterate = scripts['verify:iter:inner'];

    it('the hook runs docs:check through the script, staged', () => {
        assert.match(hook, /node scripts\/docs-trigger\.mjs --staged/);
    });

    it('the iterate chain runs docs:check through the same script', () => {
        assert.ok(iterate.split(/\s+&&\s+/).includes('node scripts/docs-trigger.mjs'));
    });

    it('neither keeps a pattern of its own', () => {
        assert.doesNotMatch(hook, /grep\b[^\n]*(?:md|mdc|gate-tiers)/);
        assert.equal(hook.includes('docs-check\\.'), false);
        assert.equal(iterate.includes('gate-tiers'), false);
        assert.equal(existsSync('scripts/docs-trigger.mjs'), true);
    });
});
