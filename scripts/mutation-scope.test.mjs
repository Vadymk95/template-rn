// Guards the mutation scope against drifting away from the coverage scope. `mutate` in
// stryker.config.json and `collectCoverageFrom` in package.json describe ONE scope in two
// hand-mirrored lists — the drift class that had already fired in the sibling templates, so parity is
// asserted instead of assumed. Unlike the fixture-based specs next door, this one reads the LIVE
// configs on purpose: the live lists ARE the subject, and the test exists to fail the gate when
// someone edits one list and not the other.
//
// Runner: `node:test`, not Jest — same reason as the other gate specs here (executable `.mjs`, and
// keeping tooling specs out of `collectCoverageFrom`). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const readJson = (file) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8'));

const coverage = readJson('package.json').jest.collectCoverageFrom;
const mutate = readJson('stryker.config.json').mutate;

// The one sanctioned difference between the lists: Stryker must not mutate the tests that are
// supposed to kill the mutants, so the test-file negation exists only on the mutate side.
const MUTATE_ONLY_NEGATION = '!src/**/*.test.*';

const negations = (globs) => globs.filter((glob) => glob.startsWith('!'));
const bases = (globs) => globs.filter((glob) => !glob.startsWith('!'));

describe('stryker mutate mirrors jest collectCoverageFrom', () => {
    it('uses the same base include globs', () => {
        assert.deepEqual([...bases(mutate)].sort(), [...bases(coverage)].sort());
    });

    it('carries every coverage negation', () => {
        const missing = negations(coverage).filter((glob) => !mutate.includes(glob));

        assert.deepEqual(
            missing,
            [],
            `collectCoverageFrom negation(s) missing from stryker mutate: ${missing.join(', ')}`
        );
    });

    it('adds no negation of its own beyond the test-file pattern', () => {
        const extra = negations(mutate).filter(
            (glob) => glob !== MUTATE_ONLY_NEGATION && !coverage.includes(glob)
        );

        assert.deepEqual(
            extra,
            [],
            `stryker mutate negation(s) missing from collectCoverageFrom: ${extra.join(', ')}`
        );
    });
});
