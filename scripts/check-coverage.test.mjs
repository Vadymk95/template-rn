// Guards the coverage-dropout marker. Runner: `node:test`, not Jest — same reason as the other gate specs
// here (executable `.mjs`, and keeping tooling specs out of `collectCoverageFrom`). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findCoverageDropouts } from './check-coverage.mjs';

// Copied verbatim from a measured run: an unparseable file was placed in `src/lib/` and `jest --coverage`
// printed this, reported an unchanged 95.51%, and exited 0.
const MEASURED_DROPOUT = 'Failed to collect coverage from /repo/src/lib/broken.ts';

describe('findCoverageDropouts', () => {
    it('finds the line jest actually prints', () => {
        assert.deepEqual(
            findCoverageDropouts(`some output\n${MEASURED_DROPOUT}\nAll files | 95.51 |`),
            [MEASURED_DROPOUT]
        );
    });

    it('finds every dropout, not just the first', () => {
        const output = [MEASURED_DROPOUT, MEASURED_DROPOUT.replace('broken', 'alsoBroken')].join(
            '\n'
        );

        assert.equal(findCoverageDropouts(output).length, 2);
    });

    it('stays quiet on a clean run', () => {
        assert.deepEqual(findCoverageDropouts('Tests: 103 passed\nAll files | 95.51 |'), []);
        assert.deepEqual(findCoverageDropouts(''), []);
    });

    it('does not fire on an ordinary failure that merely mentions coverage', () => {
        // The marker is jest's exact sentence. A looser match would report the wrong cause for a normal
        // test failure that happens to print the word.
        assert.deepEqual(
            findCoverageDropouts('Jest: "global" coverage threshold for statements not met'),
            []
        );
        assert.deepEqual(findCoverageDropouts('Failed to collect'), []);
    });
});
