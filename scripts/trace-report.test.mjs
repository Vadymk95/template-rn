// Guards the findings analyser. Its whole design point is that it names no stage itself: every
// rule reads moments, budgets and classes out of gate-tiers.json, so the discipline changes by
// editing that JSON. These fixtures therefore hand it their OWN tiny tiers object.
//
// Runner: `node:test` (see gate-trace.test.mjs for why). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    computeFindings,
    isNested,
    parseLog,
    parseLogLine,
    resolveMoment
} from './trace-report.mjs';

const TIERS = {
    checks: {
        'verify:iter': { class: 'code' },
        'verify:ci': { class: 'code' },
        test: { class: 'code' }
    },
    moments: {
        iterate: {
            expected: ['verify:iter'],
            forbidden: ['test'],
            budgetSeconds: 15,
            runsRegardlessOfDiff: false,
            requiresMainCheckout: false
        },
        push: {
            expected: ['verify:ci'],
            forbidden: [],
            budgetSeconds: 30,
            runsRegardlessOfDiff: true,
            requiresMainCheckout: true
        }
    }
};

const row = (overrides = {}) =>
    parseLogLine(
        [
            overrides.timestamp ?? '2026-08-30T10:00:00.000Z',
            overrides.label ?? 'verify:iter',
            String(overrides.durationMs ?? 1000),
            overrides.exitCode ?? '0',
            'master',
            overrides.toplevel ?? '/repo',
            overrides.worktreeKind ?? 'main',
            overrides.changeClass ?? 'code'
        ].join('\t'),
        1
    );

describe('parseLogLine', () => {
    it('marks a line with the wrong field count as malformed instead of guessing', () => {
        const parsed = parseLogLine('only\tthree\tfields', 7);
        assert.equal(parsed.malformed, true);
        assert.equal(parsed.lineNumber, 7);
    });

    it('parses a well-formed line into named fields', () => {
        const parsed = row({ label: 'verify:ci', durationMs: 20000 });
        assert.equal(parsed.malformed, false);
        assert.equal(parsed.label, 'verify:ci');
        assert.equal(parsed.durationMs, 20000);
        assert.equal(parsed.exitCode, 0);
    });

    it('flags a missing exit code instead of coercing it to a number', () => {
        const parsed = row({ exitCode: '' });
        assert.equal(parsed.exitCodeValid, false);
        assert.equal(parsed.exitCode, null);
    });
});

describe('parseLog', () => {
    it('skips empty lines', () => {
        assert.equal(parseLog('a\n\nb\n').length, 2);
    });
});

describe('isNested', () => {
    it('treats a shorter run fully inside a longer one at the same toplevel as nested', () => {
        const outer = row({ durationMs: 60000 });
        const inner = row({
            timestamp: '2026-08-30T10:00:10.000Z',
            durationMs: 5000,
            label: 'test'
        });
        assert.equal(isNested(inner, [outer, inner]), true);
    });

    it('does not treat two disjoint runs as nested', () => {
        const first = row({ durationMs: 1000 });
        const second = row({ timestamp: '2026-08-30T11:00:00.000Z', durationMs: 1000 });
        assert.equal(isNested(second, [first, second]), false);
    });
});

describe('resolveMoment', () => {
    it('finds the home moment for an expected label', () => {
        const resolved = resolveMoment('verify:ci', TIERS.moments);
        assert.equal(resolved.name, 'push');
        assert.equal(resolved.legitimate, true);
    });

    it('resolves a forbidden label to the moment that forbids it', () => {
        const resolved = resolveMoment('test', TIERS.moments);
        assert.equal(resolved.name, 'iterate');
        assert.equal(resolved.legitimate, false);
    });

    it('returns null for a label no moment names', () => {
        assert.equal(resolveMoment('untracked-thing', TIERS.moments), null);
    });
});

describe('computeFindings', () => {
    it('reports a forbidden stage run standalone', () => {
        const findings = computeFindings([row({ label: 'test', durationMs: 9000 })], TIERS);
        assert.ok(findings.some((f) => f.message.includes('forbidden at the "iterate" moment')));
    });

    it('reports a run over its moment budget', () => {
        const findings = computeFindings([row({ durationMs: 16000 })], TIERS);
        assert.ok(findings.some((f) => f.message.includes('over the "iterate" moment')));
    });

    it('reports a code-class check run against a docs-only change', () => {
        const findings = computeFindings([row({ changeClass: 'docs' })], TIERS);
        assert.ok(findings.some((f) => f.message.includes('docs-only change')));
    });

    it('reports a push-moment run from a linked worktree', () => {
        const findings = computeFindings(
            [row({ label: 'verify:ci', durationMs: 20000, worktreeKind: 'worktree' })],
            TIERS
        );
        assert.ok(findings.some((f) => f.message.includes('requires the main checkout')));
    });

    it('suppresses a run nested inside a longer sibling — sub-steps are not decisions', () => {
        const outer = row({ label: 'verify:ci', durationMs: 25000 });
        const inner = row({
            label: 'test',
            timestamp: '2026-08-30T10:00:10.000Z',
            durationMs: 5000
        });
        const findings = computeFindings([outer, inner], TIERS);
        assert.equal(
            findings.some((f) => f.message.includes('forbidden')),
            false
        );
    });

    it('reports malformed lines as log-integrity findings', () => {
        const findings = computeFindings(parseLog('garbage-line\n'), TIERS);
        assert.ok(findings.some((f) => f.actor === 'log integrity'));
    });
});
