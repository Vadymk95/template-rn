// `capture-bundle-metrics.mjs` is the bundle budget that CI runs (`perf:check`). Every comparison of
// a number with a NaN is false, so a budget fed a missing size or a mistyped percentage would read
// "not over the limit" and pass. These cases pin the refusal of every input that is not a usable
// number, and that merely importing the module runs no export and reads no baseline.
//
// Runner: `node:test` (Jest 29 does not discover `.mjs` gate scripts). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkPair, readThresholdPct } from './capture-bundle-metrics.mjs';

const SCRIPT = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'capture-bundle-metrics.mjs'
);

const check = (overrides = {}) =>
    checkPair({ name: 'ios', currentBytes: 1000, baseBytes: 1000, thresholdPct: 5, ...overrides });

describe('readThresholdPct', () => {
    it('defaults to 5 when the variable is unset', () => {
        assert.equal(readThresholdPct({}), 5);
    });

    it('reads a number, zero included', () => {
        assert.equal(readThresholdPct({ PERF_THRESHOLD_PCT: '10' }), 10);
        assert.equal(readThresholdPct({ PERF_THRESHOLD_PCT: '0' }), 0);
        assert.equal(readThresholdPct({ PERF_THRESHOLD_PCT: '2.5' }), 2.5);
    });

    it('turns text and an empty or blank value into NaN rather than 0', () => {
        assert.ok(Number.isNaN(readThresholdPct({ PERF_THRESHOLD_PCT: 'abc' })));
        assert.ok(Number.isNaN(readThresholdPct({ PERF_THRESHOLD_PCT: '' })));
        assert.ok(Number.isNaN(readThresholdPct({ PERF_THRESHOLD_PCT: '  ' })));
    });
});

describe('checkPair with usable numbers', () => {
    it('passes a bundle equal to the baseline', () => {
        const result = check();

        assert.equal(result.ok, true);
        assert.match(result.message, /OK ios: within \+5% of baseline \(1000 bytes\)/);
    });

    it('passes a smaller bundle', () => {
        assert.equal(check({ currentBytes: 400 }).ok, true);
    });

    it('passes a bundle exactly on the limit and fails one byte over', () => {
        assert.equal(check({ currentBytes: 1050 }).ok, true);

        const over = check({ currentBytes: 1051 });

        assert.equal(over.ok, false);
        assert.match(over.message, /FAIL ios: 1051 > baseline\+5% \(1050, baseline 1000\)/);
    });

    it('floors the limit to whole bytes', () => {
        // 1003 * 1.05 = 1053.15
        assert.equal(check({ baseBytes: 1003, currentBytes: 1053 }).ok, true);
        const over = check({ baseBytes: 1003, currentBytes: 1054 });

        assert.equal(over.ok, false);
        // For whole-byte sizes the verdict is the same with or without the floor; the printed limit is not.
        assert.match(over.message, /\(1053, baseline 1003\)/);
    });

    it('allows no growth at a threshold of 0', () => {
        assert.equal(check({ thresholdPct: 0, currentBytes: 1000 }).ok, true);
        assert.equal(check({ thresholdPct: 0, currentBytes: 1001 }).ok, false);
    });

    it('prints nothing itself', () => {
        const lines = [];
        const original = console.error;
        console.error = (...args) => lines.push(args);
        try {
            check();
            check({ currentBytes: 5000 });
        } finally {
            console.error = original;
        }

        assert.deepEqual(lines, []);
    });
});

describe('checkPair refuses what is not a usable number', () => {
    for (const [label, value] of [
        ['NaN', Number.NaN],
        ['undefined', undefined],
        ['null', null],
        ['Infinity', Number.POSITIVE_INFINITY],
        ['a numeric string', '1000'],
        ['a negative number', -5]
    ]) {
        it(`refuses a threshold that is ${label}, naming the variable and the value`, () => {
            const result = check({ thresholdPct: value });

            assert.equal(result.ok, false);
            assert.match(result.message, /PERF_THRESHOLD_PCT/);
            assert.ok(result.message.includes(`(got ${String(value)})`));
        });
    }

    for (const [label, value] of [
        ['undefined (the key is missing)', undefined],
        ['NaN', Number.NaN],
        ['null', null],
        ['zero', 0],
        ['negative', -1],
        ['Infinity', Number.POSITIVE_INFINITY],
        ['a numeric string', '1000']
    ]) {
        it(`refuses baseline bytes that are ${label}, naming the baseline file`, () => {
            const result = check({ baseBytes: value });

            assert.equal(result.ok, false);
            assert.match(result.message, /scripts\/perf-baseline\.json/);
            assert.ok(result.message.includes(`(got ${String(value)})`));
        });

        it(`refuses measured bytes that are ${label}, naming the measurement`, () => {
            const result = check({ currentBytes: value });

            assert.equal(result.ok, false);
            assert.match(result.message, /measured bundle bytes/);
            assert.ok(result.message.includes(`(got ${String(value)})`));
        });
    }

    it('refuses a missing size on either side even when the threshold is huge', () => {
        assert.equal(check({ thresholdPct: 1e9, currentBytes: undefined }).ok, false);
        assert.equal(check({ thresholdPct: 1e9, baseBytes: undefined }).ok, false);
    });

    it('names the platform in every refusal', () => {
        assert.match(check({ name: 'android', baseBytes: 0 }).message, /FAIL android:/);
    });
});

describe('the module as a script', () => {
    const run = (args) =>
        spawnSync(process.execPath, args, {
            encoding: 'utf8',
            env: { ...process.env, PERF_THRESHOLD_PCT: 'not-a-number' }
        });

    it('runs nothing and prints nothing when it is only imported', () => {
        const result = run([
            '--input-type=module',
            '-e',
            `await import(${JSON.stringify(SCRIPT)}); console.log('imported');`
        ]);

        assert.equal(result.status, 0);
        assert.equal(result.stdout, 'imported\n');
        assert.equal(result.stderr, '');
    });

    it('still runs its main when started directly', () => {
        const result = run([SCRIPT, '--help']);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /Usage:/);
    });
});
