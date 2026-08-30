// Guards the hooks check. Two failure modes it must catch, both measured in sibling repos: hooks
// never installed (lifecycle scripts are off by .npmrc), and a STALE core.hooksPath left behind by
// a repo move, where git silently skips every hook while .husky/_ still sits on disk.
//
// Runner: `node:test` (see gate-trace.test.mjs for why). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/check-hooks.mjs');

/* Throwaway repos only — a guard test that mutates the guarded state would be its own incident.
   GIT_* is stripped for the same reason: inherited from a hook it points the child git at the
   REAL repo. */
const CLEAN_ENV = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    CI: ''
};

const makeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-hooks-'));
    execFileSync('git', ['init', '-q'], { cwd: dir, env: CLEAN_ENV });
    return dir;
};

const run = (cwd, env = {}) => {
    try {
        const output = execFileSync('node', [SCRIPT], {
            cwd,
            encoding: 'utf8',
            env: { ...CLEAN_ENV, ...env }
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const cleanupDirs = [];

afterEach(() => {
    while (cleanupDirs.length > 0) {
        const dir = cleanupDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('check-hooks', () => {
    it('passes when core.hooksPath resolves to this repo .husky/_', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        mkdirSync(join(repo, '.husky/_'), { recursive: true });
        execFileSync('git', ['config', 'core.hooksPath', '.husky/_'], {
            cwd: repo,
            env: CLEAN_ENV
        });
        assert.equal(run(repo).code, 0);
    });

    it('refuses a hooksPath pointing elsewhere, and prints the one-line fix', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        mkdirSync(join(repo, '.husky/_'), { recursive: true });
        execFileSync('git', ['config', 'core.hooksPath', '/tmp/nowhere/.husky/_'], {
            cwd: repo,
            env: CLEAN_ENV
        });
        const verdict = run(repo);
        assert.equal(verdict.code, 1);
        assert.ok(verdict.output.includes('git config core.hooksPath .husky/_'));
    });

    it('refuses an UNSET hooksPath even though .husky/_ exists', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        mkdirSync(join(repo, '.husky/_'), { recursive: true });
        const verdict = run(repo);
        assert.equal(verdict.code, 1);
        assert.ok(verdict.output.includes('git config core.hooksPath .husky/_'));
    });

    it('still fails loudly when .husky/_ is missing entirely', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        const verdict = run(repo);
        assert.equal(verdict.code, 1);
        assert.ok(verdict.output.includes('npm run prepare'));
    });

    it('skips on CI, where hooks are not installed by design', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        assert.equal(run(repo, { CI: 'true' }).code, 0);
    });

    it('answers for the CWD repo even when a hook-exported GIT_DIR points at another repo', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        mkdirSync(join(repo, '.husky/_'), { recursive: true });
        execFileSync('git', ['config', 'core.hooksPath', '.husky/_'], {
            cwd: repo,
            env: CLEAN_ENV
        });
        const otherRepo = makeRepo();
        cleanupDirs.push(otherRepo);
        assert.equal(
            run(repo, { GIT_DIR: join(otherRepo, '.git'), GIT_WORK_TREE: otherRepo }).code,
            0
        );
    });
});
