// The `test:scripts` stage runs every spec file of the gate scripts with `node --test`, and nothing
// shortens that run: the harness tests that moved to gatelaw are gone from this folder, so what is
// left here is all of it. The one thing the stage takes from its environment is a cap on how many
// spec files node runs at once, because a lane that runs the stage next to others must name a worker
// cap and `node --test` reads none from the environment on its own.
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CAP_VARIABLE, run, TEST_PATTERN, testArguments } from './test-scripts.mjs';

const { afterEach, describe, it } = globalThis.describe ? globalThis : await import('node:test');

const SCRIPT = path.resolve(process.cwd(), 'scripts/test-scripts.mjs');
const CAPTURE = ['ignore', 'pipe', 'pipe'];

describe('testArguments: the arguments of the node that runs the specs', () => {
    it('is `--test` and the pattern when no cap is set, as the stage has always been', () => {
        assert.deepEqual(testArguments({}), ['--test', 'scripts/**/*.test.mjs']);
    });

    it('is the same when the cap variable is empty', () => {
        assert.deepEqual(testArguments({ [CAP_VARIABLE]: '' }), ['--test', TEST_PATTERN]);
    });

    it('caps how many spec files run at once when the cap variable holds a whole number', () => {
        assert.deepEqual(testArguments({ [CAP_VARIABLE]: '2' }), [
            '--test',
            '--test-concurrency=2',
            TEST_PATTERN
        ]);
        assert.deepEqual(testArguments({ [CAP_VARIABLE]: '16' }), [
            '--test',
            '--test-concurrency=16',
            TEST_PATTERN
        ]);
    });

    for (const value of ['0', '-1', '1.5', '2x', ' 2', 'two', '02', '1e3']) {
        it(`refuses ${JSON.stringify(value)}: a cap that is not a positive whole number is never read as no cap`, () => {
            assert.throws(
                () => testArguments({ [CAP_VARIABLE]: value }),
                new RegExp(`${CAP_VARIABLE}=.*not a positive whole number`)
            );
        });
    }
});

describe('run: what the stage starts and the exit code it gives back', () => {
    it('starts node with the arguments the environment gives, and no shell', () => {
        const calls = [];
        const spawn = (command, args, options) => {
            calls.push({ command, args, options });
            return { status: 0 };
        };

        assert.equal(run({ env: { [CAP_VARIABLE]: '2' }, spawn }), 0);
        assert.deepEqual(calls, [
            {
                command: process.execPath,
                args: ['--test', '--test-concurrency=2', TEST_PATTERN],
                options: { stdio: 'inherit', shell: false }
            }
        ]);
    });

    it('gives back the exit code of the node it started', () => {
        assert.equal(run({ env: {}, spawn: () => ({ status: 3 }) }), 3);
    });

    it('reads a node that ended on a signal as a failing exit', () => {
        assert.equal(run({ env: {}, spawn: () => ({ status: null, signal: 'SIGKILL' }) }), 1);
    });

    it('starts nothing for a cap it refuses', () => {
        const spawn = () => assert.fail('node must not start');

        assert.throws(() => run({ env: { [CAP_VARIABLE]: 'abc' }, spawn }), /not a positive/);
    });
});

describe('the test:scripts runner against a folder of spec files', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    // `kills` ends the process that started this spec, which is the `node --test` the script started.
    const specFile = (name, { fails = false, kills = false } = {}) =>
        `import { it } from 'node:test';\nit('ran ${name}', () => { ${
            fails ? "throw new Error('seeded failure');" : ''
        }${kills ? "process.kill(process.ppid, 'SIGKILL');" : ''} });\n`;

    const makeFolder = (specs) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'test-scripts-'));
        dirs.push(dir);
        mkdirSync(path.join(dir, 'scripts'));
        for (const [name, options] of Object.entries(specs)) {
            writeFileSync(path.join(dir, `scripts/${name}.test.mjs`), specFile(name, options));
        }
        return dir;
    };

    const start = (dir, env = {}) => {
        // The cap variable is the only one that matters here; the others of the caller stay out.
        const clean = Object.fromEntries(
            Object.entries(process.env).filter(
                ([key]) => !key.startsWith('NODE_TEST') && key !== CAP_VARIABLE
            )
        );
        const result = spawnSync(process.execPath, [SCRIPT], {
            cwd: dir,
            env: { ...clean, ...env },
            encoding: 'utf8',
            stdio: CAPTURE
        });
        return { code: result.status, output: `${result.stdout}${result.stderr}` };
    };

    it('runs every spec file of the folder, with and without a cap', { timeout: 60_000 }, () => {
        const dir = makeFolder({ a: {}, b: {}, c: {} });

        for (const env of [{}, { [CAP_VARIABLE]: '1' }]) {
            const { code, output } = start(dir, env);

            assert.equal(code, 0);
            for (const name of ['a', 'b', 'c']) assert.match(output, new RegExp(`ran ${name}`));
        }
    });

    it('passes a failing test file on as a failing exit', { timeout: 60_000 }, () => {
        const dir = makeFolder({ a: {}, b: { fails: true } });

        assert.notEqual(start(dir).code, 0);
        assert.notEqual(start(dir, { [CAP_VARIABLE]: '1' }).code, 0);
    });

    it(
        'ends with a failing exit when the node --test it started is killed by a signal',
        { timeout: 60_000 },
        () => {
            const dir = makeFolder({ a: {}, b: { kills: true } });

            assert.equal(start(dir).code, 1);
        }
    );

    it('refuses a cap that is not a whole number with one message and runs nothing', () => {
        const dir = makeFolder({ a: {} });

        const { code, output } = start(dir, { [CAP_VARIABLE]: 'abc' });

        assert.equal(code, 1);
        assert.match(output, /NODE_TEST_CONCURRENCY="abc" is not a positive whole number/);
        assert.doesNotMatch(output, /ran a/);
    });
});
