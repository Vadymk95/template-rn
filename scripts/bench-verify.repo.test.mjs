// The cases of bench-verify.test.mjs that read this repository's own package.json: the benchmark's
// step list must follow the real gate scripts. The rest of that file lives in gatelaw, where it runs
// over fixture packages.
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expandSteps, parseVerifySteps, resolveScript } from './bench-verify.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

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

describe('expandSteps', () => {
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
