// Guards that the benchmark's step list cannot drift from the gate it claims to mirror. The
// hand-written list in the sibling templates had already lost two steps while its own header said they
// matched, which is why the list is now DERIVED from the `verify` script.
//
// Runner: `node:test`, not Jest — same reason as the other gate specs here (executable `.mjs`, and
// keeping tooling specs out of `collectCoverageFrom`). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { expandSteps, parseVerifySteps, resolveScript } from './bench-verify.mjs';

const scripts = () => JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).scripts;

describe('parseVerifySteps', () => {
    it('covers every step of the real verify script', () => {
        const script = resolveScript(scripts(), 'verify');
        const steps = parseVerifySteps(script);

        assert.equal(steps.length, script.split('&&').length);
        for (const step of steps) {
            assert.ok(step.label.length > 0);
        }
    });

    it('includes the steps a hand-written list tends to omit', () => {
        const labels = parseVerifySteps(resolveScript(scripts(), 'verify')).map(
            (step) => step.label
        );

        assert.ok(labels.includes('check-hooks'));
        assert.ok(labels.includes('test:coverage'));
    });

    it('keeps the version-holds check in the gate, so a bump past a hold turns verify red', () => {
        const labels = parseVerifySteps(resolveScript(scripts(), 'verify')).map(
            (step) => step.label
        );

        assert.ok(labels.includes('check-version-holds'));
    });

    it('keeps docs-check in verify, so doc drift that skipped the commit hook turns the push red', () => {
        const labels = parseVerifySteps(resolveScript(scripts(), 'verify')).map(
            (step) => step.label
        );

        assert.ok(labels.includes('docs-check'));
    });

    it('keeps the sibling-test range check inside verify, never only in the network tier', () => {
        // The raw script, not the parsed steps: the benchmark keeps only a step's file, never its flags.
        const all = scripts();

        assert.ok(
            resolveScript(all, 'verify').includes('node scripts/check-test-siblings.mjs --range')
        );
        // The check is offline, so only verify carries it; verify:ci adds the registry checks on top and
        // must not run it a second time.
        assert.ok(!all['verify:ci:inner'].includes('check-test-siblings'));
    });

    it('labels an npm step by its script name and a node step by its file', () => {
        assert.deepEqual(parseVerifySteps('npm run typecheck && node scripts/check-hooks.mjs'), [
            { label: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
            { label: 'check-hooks', command: 'node', args: ['scripts/check-hooks.mjs'] }
        ]);
    });

    it('throws on a shape it does not know, rather than skipping the step', () => {
        // Skipping is the failure this file exists for: a step absent from the benchmark is a step
        // nobody knows is slow, and the run still reports success.
        assert.throws(
            () => parseVerifySteps('npm run lint && EXPO_X=1 jest'),
            /cannot parse verify step/
        );
    });

    it('ignores empty segments from a trailing separator', () => {
        assert.equal(parseVerifySteps('npm run lint &&  ').length, 1);
    });
});

describe('resolveScript', () => {
    it('follows an alias to the script that holds the steps', () => {
        assert.equal(
            resolveScript(
                { verify: 'npm run verify:all', 'verify:all': 'npm run lint && npm run test' },
                'verify'
            ),
            'npm run lint && npm run test'
        );
    });

    it('returns a non-alias script unchanged', () => {
        assert.equal(
            resolveScript({ verify: 'npm run lint && npm run test' }, 'verify'),
            'npm run lint && npm run test'
        );
    });

    it('follows the gate-trace wrapper to its inner script — the steps live there', () => {
        const scripts = {
            verify: 'node scripts/gate-trace.mjs verify -- npm run verify:inner',
            'verify:inner': 'npm run lint && npm run typecheck'
        };

        assert.equal(resolveScript(scripts, 'verify'), 'npm run lint && npm run typecheck');
    });

    it('throws on a cycle routed through the gate-trace wrapper form too', () => {
        assert.throws(
            () => resolveScript({ a: 'node scripts/gate-trace.mjs a -- npm run a' }, 'a'),
            /cycle/
        );
    });

    it('throws on a cycle instead of looping forever', () => {
        assert.throws(() => resolveScript({ a: 'npm run b', b: 'npm run a' }, 'a'), /cycle/);
    });

    it('throws when the script does not exist', () => {
        assert.throws(() => resolveScript({}, 'verify'), /no `verify` script/);
    });
});

describe('the iteration loop', () => {
    // `.npmrc` disables lifecycle scripts, so a fresh clone has no git hooks until `npm run prepare`.
    // `verify:iter` is the loop that runs while working, long before `verify` does: when only `verify`
    // checks the hooks, the first push goes out with no gate and prints nothing about it.
    it('starts with the hooks check, so a clone without hooks fails before the first push', () => {
        const iterate = resolveScript(scripts(), 'verify:iter');

        assert.ok(
            iterate.startsWith('node scripts/check-hooks.mjs && '),
            `verify:iter must begin with the hooks check, got: ${iterate}`
        );
    });
});

describe('parseVerifySteps keeps every argument of a step', () => {
    it('keeps a node step flags and an npm step extra arguments', () => {
        const steps = parseVerifySteps('node scripts/a.mjs --kill-port && npm run lint -- --fix');

        assert.deepEqual(
            steps.map((step) => step.args),
            [
                ['scripts/a.mjs', '--kill-port'],
                ['run', 'lint', '--', '--fix']
            ]
        );
    });
});

describe('expandSteps', () => {
    const stub = {
        top: 'node scripts/gate-trace.mjs top -- npm run top:inner',
        'top:inner': 'node scripts/a.mjs --range && npm run alias && npm run chain',
        alias: 'npm run single',
        single: 'oxlint --deny-warnings .',
        chain: 'tsc -b && vite build'
    };

    it('follows the wrapper and aliases and expands a nested chain in run order, flags kept', () => {
        assert.deepEqual(expandSteps(stub, 'top'), [
            { label: 'top:inner#1', command: 'node', args: ['scripts/a.mjs', '--range'] },
            { label: 'single', command: 'oxlint', args: ['--deny-warnings', '.'] },
            { label: 'chain#1', command: 'tsc', args: ['-b'] },
            { label: 'chain#2', command: 'vite', args: ['build'] }
        ]);
    });

    it('throws on a cycle, also through the wrapper, and on a script that does not exist', () => {
        const loop = { a: 'npm run b', b: 'node scripts/gate-trace.mjs b -- npm run a' };

        assert.throws(() => expandSteps(loop, 'a'), /cycle a -> b -> a/);
        assert.throws(() => expandSteps({ a: 'npm run gone' }, 'a'), /no `gone` script/);
    });

    it('hands a segment npm would give its shell to the shell, whole, never reads it as words', () => {
        assert.deepEqual(expandSteps({ a: 'node b.mjs && FOO=1 node c.mjs' }, 'a'), [
            { label: 'a#1', command: 'node', args: ['b.mjs'] },
            { label: 'a#2', command: 'sh', args: ['-c', 'FOO=1 node c.mjs'] }
        ]);
        // A quote may hold the separator: the script is one shell step, never split inside it.
        const quoted = 'node -e "a && b" && npm run y';
        assert.deepEqual(expandSteps({ a: quoted, y: 'x' }, 'a'), [
            { label: 'a', command: 'sh', args: ['-c', quoted] }
        ]);
    });

    it('throws on a script npm would wrap in a pre or post script, rather than drop that step', () => {
        assert.throws(() => expandSteps({ a: 'node b.mjs', prea: 'node c.mjs' }, 'a'), /prea/);
        assert.throws(() => expandSteps({ a: 'node b.mjs', posta: 'node c.mjs' }, 'a'), /posta/);
    });

    it('expands the gate scripts of this package with their flags', () => {
        const lines = (target) =>
            expandSteps(scripts(), target).map((step) => [step.command, ...step.args].join(' '));

        assert.ok(lines('verify:ci').includes('node scripts/check-test-siblings.mjs --range'));
        assert.ok(lines('verify:iter').includes('node scripts/check-test-siblings.mjs --changed'));
        for (const target of ['verify:ci', 'verify:iter']) {
            assert.ok(!lines(target).join('\n').includes('npm run'), target);
        }
    });
});

describe('--run: runSteps in a stub package', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    // A package whose `gate` script is `gate`; `files` are written beside it. Returns the run of `--run <target>`.
    const runGate = (gate, files, env = {}, target = 'gate') => {
        const dir = mkdtempSync(join(tmpdir(), 'bench-verify-'));
        dirs.push(dir);
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { gate } }));
        for (const [name, text] of Object.entries(files)) {
            mkdirSync(dirname(join(dir, name)), { recursive: true });
            writeFileSync(join(dir, name), text, { mode: 0o755 });
        }
        const result = spawnSync(
            process.execPath,
            [join(process.cwd(), 'scripts/bench-verify.mjs'), '--run', target],
            {
                cwd: dir,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, GATE_TRACE_STEP_FILE: join(dir, 'step'), ...env }
            }
        );
        return { ...result, dir, has: (name) => existsSync(join(dir, name)) };
    };
    const THREE = 'node a.mjs && node b.mjs && node c.mjs';
    const MARK = "require('node:fs').writeFileSync('c-ran', '');";

    it('stops at the first red: the verdict names the step, the status is its own, the label is written', () => {
        const result = runGate(THREE, { 'a.mjs': '', 'b.mjs': 'process.exit(3);', 'c.mjs': MARK });

        assert.equal(result.status, 3);
        assert.match(result.stdout, /→ step 2\/3 gate#2: node b\.mjs/);
        assert.match(
            result.stderr,
            /✖ gate: step gate#2 failed \(exit 3\) after \d+\.\d s; 1 later steps not run/
        );
        assert.equal(result.has('c-ran'), false);
        assert.equal(readFileSync(join(result.dir, 'step'), 'utf8'), 'gate#2');
    });

    it('answers a script it cannot expand with a verdict line and exit 1', () => {
        const result = runGate(THREE, {}, {}, 'nope');

        assert.equal(result.status, 1);
        assert.match(result.stderr, /✖ nope: package\.json has no `nope` script to run\./);
    });

    it('reads a step killed by a signal as exit 1', () => {
        const kill = "process.kill(process.pid, 'SIGKILL');";
        const result = runGate(THREE, { 'a.mjs': '', 'b.mjs': kill, 'c.mjs': MARK });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /step gate#2 failed \(exit 1\)/);
        assert.equal(result.has('c-ran'), false);
    });

    it('runs an env prefix and a node_modules/.bin tool the way npm does, the step file variable unseen', () => {
        const result = runGate('node a.mjs && FOO=1 node b.mjs && stub-tool --flag', {
            'a.mjs': 'process.exit(process.env.GATE_TRACE_STEP_FILE === undefined ? 0 : 6);',
            'b.mjs': 'process.exit(process.env.FOO === "1" ? 0 : 5);',
            'node_modules/.bin/stub-tool': '#!/bin/sh\n[ "$1" = "--flag" ] && : > tool-ran\n'
        });

        assert.equal(result.status, 0);
        assert.match(result.stdout, /✓ gate: 3 steps passed in \d+\.\d s/);
        assert.equal(result.has('tool-ran'), true);
        assert.equal(result.has('step'), false);
    });
});
