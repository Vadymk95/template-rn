// Guards the hooks check. Three failure modes it must catch, all measured: hooks never installed
// (lifecycle scripts are off by .npmrc), a STALE core.hooksPath left behind by a repo move, where
// git silently skips every hook while .husky/_ still sits on disk, and a folder that is there with
// the path right but a hook with no executable file in it, where git skips that hook just as
// silently.
//
// Runner: `node:test` (see gate-trace.test.mjs for why). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
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

/* Every child captures its output. `execFileSync` copies the child's stderr onto the test run's
   unless `stdio` is given, and the refusals these cases provoke would then read like real failures
   in every log; `run` hands the captured text back for the assertions. */
const CAPTURE = ['ignore', 'pipe', 'pipe'];

const makeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-hooks-'));
    execFileSync('git', ['init', '-q'], { cwd: dir, env: CLEAN_ENV, stdio: CAPTURE });
    return dir;
};

const run = (cwd, env = {}) => {
    try {
        const output = execFileSync('node', [SCRIPT], {
            cwd,
            encoding: 'utf8',
            env: { ...CLEAN_ENV, ...env },
            stdio: CAPTURE
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const put = (path, text, mode) => {
    writeFileSync(path, text);
    chmodSync(path, mode);
};

const HOOKS = ['pre-commit', 'commit-msg', 'pre-push'];

/* What `npm run prepare` leaves: the hook bodies under .husky/ WITHOUT the exec bit (a shim runs
   them through sh), one executable shim per hook under .husky/_, and the helper files there. Modes
   are set with chmod, never left to the umask. `without` leaves shims out, `stripped` takes the
   exec bit off the named shims, a `hooksPath` of null leaves core.hooksPath unset. */
const installHooks = (dir, { without = [], stripped = [], hooksPath = '.husky/_' } = {}) => {
    const shims = join(dir, '.husky/_');
    mkdirSync(shims, { recursive: true });
    put(join(shims, 'h'), '# helper\n', 0o644);
    put(join(shims, 'husky.sh'), '# helper\n', 0o644);
    for (const name of HOOKS) {
        put(join(dir, '.husky', name), 'true\n', 0o644);
        if (!without.includes(name)) {
            put(join(shims, name), '#!/usr/bin/env sh\n', stripped.includes(name) ? 0o644 : 0o755);
        }
    }
    if (hooksPath !== null) {
        execFileSync('git', ['config', 'core.hooksPath', hooksPath], {
            cwd: dir,
            env: CLEAN_ENV,
            stdio: CAPTURE
        });
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
        installHooks(repo);
        assert.equal(run(repo).code, 0);
    });

    it('refuses a hooksPath pointing elsewhere, and prints the one-line fix', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        installHooks(repo, { hooksPath: '/tmp/nowhere/.husky/_' });
        const verdict = run(repo);
        assert.equal(verdict.code, 1);
        assert.ok(verdict.output.includes('git config core.hooksPath .husky/_'));
    });

    it('refuses an UNSET hooksPath even though .husky/_ exists', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        installHooks(repo, { hooksPath: null });
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
        installHooks(repo, { without: HOOKS, hooksPath: null });
        assert.equal(run(repo, { CI: 'true' }).code, 0);
    });

    describe('a hook file git would not run', () => {
        /* `core.hooksPath` is right in these cases, so the hook file is the only reason to refuse:
           git runs a hook only from an executable file and skips any other silently. */
        for (const name of HOOKS) {
            it(`refuses when the hook file for ${name} is missing, naming only it`, () => {
                const repo = makeRepo();
                cleanupDirs.push(repo);
                installHooks(repo, { without: [name] });
                const verdict = run(repo);
                assert.equal(verdict.code, 1);
                assert.ok(verdict.output.includes('Git hooks are not installed'));
                assert.ok(verdict.output.includes(name));
                for (const other of HOOKS.filter((candidate) => candidate !== name)) {
                    assert.ok(!verdict.output.includes(other));
                }
                assert.ok(verdict.output.includes('npm run prepare'));
                assert.ok(!verdict.output.includes('chmod'));
            });
        }

        it('refuses a folder holding helper files only, naming every hook', () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            installHooks(repo, { without: HOOKS });
            const verdict = run(repo);
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('Git hooks are not installed'));
            for (const name of HOOKS) {
                assert.ok(verdict.output.includes(name));
            }
            assert.ok(verdict.output.includes('npm run prepare'));
            assert.ok(!verdict.output.includes('chmod'));
        });

        it('refuses a hook file without the exec bit, with chmod and not npm run prepare', () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            installHooks(repo, { stripped: ['commit-msg'] });
            const verdict = run(repo);
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('Git hooks are not executable: commit-msg.'));
            assert.ok(!verdict.output.includes('pre-commit'));
            assert.ok(!verdict.output.includes('pre-push'));
            assert.ok(verdict.output.includes('Fix: chmod +x .husky/_/*\n'));
            assert.ok(!verdict.output.includes('npm run prepare'));
        });

        it('gives both remedies in one run when one hook is missing and another not executable', () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            installHooks(repo, { without: ['pre-push'], stripped: ['commit-msg'] });
            const verdict = run(repo);
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('Run once after cloning: npm run prepare'));
            assert.ok(verdict.output.includes('Fix: chmod +x .husky/_/*\n'));
        });

        it('refuses a body with no hook file for every hook the installed husky wires', () => {
            /* Pins HUSKY_HOOKS to the real installer: the wired names are the executable files it
               writes under .husky/_ (its helper files carry no exec bit). HUSKY is emptied because
               the CI workflows set HUSKY=0, which makes husky skip the install. */
            const repo = makeRepo();
            cleanupDirs.push(repo);
            execFileSync('node', [resolve(process.cwd(), 'node_modules/husky/bin.js')], {
                cwd: repo,
                env: { ...CLEAN_ENV, HUSKY: '' },
                stdio: CAPTURE
            });
            const shims = join(repo, '.husky/_');
            const wired = readdirSync(shims).filter(
                (file) => statSync(join(shims, file)).mode & 0o100
            );
            assert.ok(wired.length > 0);
            for (const name of wired) {
                put(join(repo, '.husky', name), 'true\n', 0o644);
                rmSync(join(shims, name));
            }
            const verdict = run(repo);
            assert.equal(verdict.code, 1);
            const line = verdict.output.match(/^Git hooks are not installed: .* for (.+)\.$/m);
            assert.deepEqual(line?.[1].split(', ').sort(), [...wired].sort());
        });

        it('needs no shim for a file under .husky that is not a hook name', () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            installHooks(repo);
            put(join(repo, '.husky/common.sh'), 'true\n', 0o644);
            assert.equal(run(repo).code, 0);
        });

        it('offers one remedy when core.hooksPath is unset and the hook files are missing', () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            installHooks(repo, { without: HOOKS, hooksPath: null });
            const verdict = run(repo);
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('npm run prepare'));
            assert.ok(!verdict.output.includes('git config core.hooksPath'));
        });
    });

    describe('an app that sits in a subfolder of its git repository', () => {
        /* The gate's scripts read git paths as relative to the repository root: staged names, the
           hooks path, `ref:path`. From a subfolder they match nothing and say nothing, and this
           check itself resolved .husky/_ against the folder it ran in, so a fully "installed" app
           there passed while git ran no hook. The app sits at the root or the check refuses. */
        const subfolderApp = () => {
            const repo = makeRepo();
            cleanupDirs.push(repo);
            const app = join(repo, 'app');
            installHooks(app);
            return app;
        };

        it('refuses, and says the app must sit at the git root', () => {
            const verdict = run(subfolderApp());
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('the app must sit at the git root'));
            assert.ok(verdict.output.includes('"app/"'));
        });

        it('refuses on CI as well, the early exit does not come first', () => {
            const verdict = run(subfolderApp(), { CI: 'true' });
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('the app must sit at the git root'));
        });

        it('answers for the CWD repo even when a hook-exported GIT_DIR points at another repo', () => {
            const app = subfolderApp();
            const otherRepo = makeRepo();
            cleanupDirs.push(otherRepo);
            const verdict = run(app, {
                GIT_DIR: join(otherRepo, '.git'),
                GIT_WORK_TREE: otherRepo
            });
            assert.equal(verdict.code, 1);
            assert.ok(verdict.output.includes('the app must sit at the git root'));
        });
    });

    it('answers for the CWD repo even when a hook-exported GIT_DIR points at another repo', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        installHooks(repo);
        const otherRepo = makeRepo();
        cleanupDirs.push(otherRepo);
        assert.equal(
            run(repo, { GIT_DIR: join(otherRepo, '.git'), GIT_WORK_TREE: otherRepo }).code,
            0
        );
    });
});
