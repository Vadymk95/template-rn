// Guards that the benchmark's step list cannot drift from the gate it claims to mirror. The
// hand-written list in the sibling templates had already lost two steps while its own header said they
// matched, which is why the list is now DERIVED from the `verify` script.
//
// Runner: `node:test`, not Jest — same reason as the other gate specs here (executable `.mjs`, and
// keeping tooling specs out of `collectCoverageFrom`). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseVerifySteps, resolveScript } from './bench-verify.mjs';

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
