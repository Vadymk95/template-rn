// Guards the audit gate's fail-CLOSED policy. A security gate that returns
// success when it cannot run is worse than no gate, so the "invalid payload"
// case below is the load-bearing one.
//
// Runner: `node:test`, not Jest. The gate scripts are executable ESM (`.mjs`)
// and Jest 29 neither discovers that extension nor loads real ESM without
// --experimental-vm-modules. Node's built-in runner needs no config and keeps
// these specs out of `collectCoverageFrom`, so gate tooling cannot drift the
// app's coverage thresholds. Run via `npm run test:scripts`.
//
// Fixtures are built inline on purpose: a test that reads the repo's live
// audit-allowlist.json breaks every time an allowance is added or expires,
// which trains people to edit the test instead of the policy.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateAudit } from './audit-gate.mjs';

const NOW = new Date('2026-01-15T00:00:00.000Z');
const ID = 'GHSA-test-aaaa-bbbb';

const advisory = (id = ID, severity = 'high') => ({
    source: 1234567,
    name: 'left-pad',
    severity,
    url: `https://github.com/advisories/${id}`,
    range: '<=1.0.0'
});

const audit = (vulnerabilities) => ({
    vulnerabilities,
    metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 }
    }
});

const allowance = (overrides = {}) => ({
    id: ID,
    expires: '2026-06-01',
    reason: 'fixture',
    upstream: 'fixture',
    ...overrides
});

const rootOnly = (id = ID, severity = 'high') =>
    audit({ 'left-pad': { severity, via: [advisory(id, severity)], effects: [] } });

const ids = (entries) => entries.map(({ id }) => id);

describe('evaluateAudit', () => {
    it('passes a clean audit with an empty allowlist', () => {
        const result = evaluateAudit(audit({}), [], NOW);

        assert.equal(result.ok, true);
        assert.equal(result.auditFailed, false);
    });

    it('fails closed when the audit itself could not be completed', () => {
        // npm printed an error object instead of a report: registry down, offline,
        // auth failure. Passing here would make the gate silently fail-open.
        const result = evaluateAudit({ error: { summary: 'registry unavailable' } }, [], NOW);

        assert.equal(result.ok, false);
        assert.equal(result.auditFailed, true);
    });

    it('fails closed on a payload missing the expected shape', () => {
        const result = evaluateAudit({ vulnerabilities: {} }, [], NOW);

        assert.equal(result.ok, false);
        assert.equal(result.auditFailed, true);
    });

    it('blocks an un-allowlisted high advisory', () => {
        const result = evaluateAudit(rootOnly(), [], NOW);

        assert.deepEqual(ids(result.unexpected), [ID]);
        assert.equal(result.ok, false);
    });

    it('lets a moderate advisory through — only high and critical block', () => {
        assert.equal(evaluateAudit(rootOnly(ID, 'moderate'), [], NOW).ok, true);
    });

    it('passes a high advisory covered by an unexpired allowance', () => {
        const result = evaluateAudit(rootOnly(), [allowance()], NOW);

        assert.equal(result.ok, true);
        assert.deepEqual(result.unexpected, []);
        assert.deepEqual(result.expired, []);
        assert.deepEqual(result.stale, []);
        assert.deepEqual(ids(result.allowlisted), [ID]);
    });

    it('fails an expired allowance even while the advisory is still present', () => {
        const result = evaluateAudit(rootOnly(), [allowance({ expires: '2026-01-14' })], NOW);

        assert.deepEqual(ids(result.expired), [ID]);
        assert.equal(result.ok, false);
    });

    it('fails an unparseable expiry date rather than treating it as far future', () => {
        const result = evaluateAudit(rootOnly(), [allowance({ expires: 'whenever' })], NOW);

        assert.deepEqual(ids(result.expired), [ID]);
        assert.equal(result.ok, false);
    });

    it('fails a stale allowance whose advisory no longer appears in the audit', () => {
        const result = evaluateAudit(audit({}), [allowance()], NOW);

        assert.deepEqual(ids(result.stale), [ID]);
        assert.equal(result.ok, false);
    });

    it('resolves a derived advisory to its root before matching the allowlist', () => {
        // npm reports the dependent package with `via: ['left-pad']` and no url of
        // its own; the allowance names the root GHSA, so the chain must resolve.
        const result = evaluateAudit(
            audit({
                'left-pad': { severity: 'high', via: [advisory()], effects: ['pad-wrapper'] },
                'pad-wrapper': { severity: 'high', via: ['left-pad'], effects: [] }
            }),
            [allowance()],
            NOW
        );

        assert.equal(result.ok, true);
        assert.deepEqual(result.unexpected, []);
    });

    it('fails closed on an unresolvable via entry', () => {
        const result = evaluateAudit(
            audit({ orphan: { severity: 'high', via: ['missing-parent'], effects: [] } }),
            [],
            NOW
        );

        assert.deepEqual(ids(result.unexpected), ['npm:orphan']);
        assert.equal(result.ok, false);
    });

    it('terminates and fails closed on a cyclic via chain', () => {
        const result = evaluateAudit(
            audit({
                first: { severity: 'high', via: ['second'], effects: [] },
                second: { severity: 'high', via: ['first'], effects: [] }
            }),
            [],
            NOW
        );

        assert.ok(ids(result.unexpected).includes('npm:first'));
        assert.equal(result.ok, false);
    });

    it('matches allowlist ids case-insensitively', () => {
        const result = evaluateAudit(rootOnly(), [allowance({ id: ID.toUpperCase() })], NOW);

        assert.equal(result.ok, true);
        assert.deepEqual(result.unexpected, []);
    });
});
