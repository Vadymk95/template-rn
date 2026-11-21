// The one case of check-hooks.test.mjs that reads the husky this repository has installed: the
// hook names the check expects must be the ones that husky wires. A husky bump that adds a hook is
// caught here, in the repository that bumps it. The other cases live in gatelaw.
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { afterEach, describe, it } = globalThis.describe ? globalThis : await import('node:test');

const SCRIPT = resolve(process.cwd(), 'scripts/check-hooks.mjs');

/* Throwaway repos only. GIT_* is stripped: inherited from a hook it points the child git at the
   REAL repo. */
const CLEAN_ENV = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    CI: ''
};

/* Every child captures its output, so the refusal this case provokes does not read like a real
   failure in the log. */
const CAPTURE = ['ignore', 'pipe', 'pipe'];

const makeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-hooks-'));
    execFileSync('git', ['init', '-q'], { cwd: dir, env: CLEAN_ENV, stdio: CAPTURE });
    return dir;
};

const run = (cwd) => {
    try {
        const output = execFileSync('node', [SCRIPT], {
            cwd,
            encoding: 'utf8',
            env: CLEAN_ENV,
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
    describe('a hook file git would not run', () => {
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
    });
});
