import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    LANES,
    QUIET_FIRST,
    QUIET_LAST,
    WINDOW_SIZE,
    quietPort,
    windowStart
} from './quiet-ports.mjs';

// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.

/* Both ephemeral ranges start at or above this; a port below it is never handed out by `listen(0)`
   or taken by an outgoing connection. */
const LOWEST_EPHEMERAL = 32_768;
const OTHER_TOOLS = { first: 20_000, last: 29_999 };

const roots = Array.from({ length: 200 }, (_, index) => `/work/checkout-${String(index)}`);

describe('windowStart', () => {
    it('gives one checkout the same window every time', () => {
        assert.equal(windowStart('/work/checkout-a'), windowStart('/work/checkout-a'));
    });

    it('keeps every window below both ephemeral ranges and clear of the block other tools use', () => {
        for (const root of roots) {
            const first = windowStart(root);
            const last = first + WINDOW_SIZE - 1;

            assert.ok(first >= QUIET_FIRST, `${root}: window starts at ${String(first)}`);
            assert.ok(last <= QUIET_LAST, `${root}: window ends at ${String(last)}`);
            assert.ok(last < LOWEST_EPHEMERAL, `${root}: window reaches an ephemeral range`);
            assert.ok(
                last < OTHER_TOOLS.first || first > OTHER_TOOLS.last,
                `${root}: window overlaps the block other tools use`
            );
        }
    });

    it('starts windows on a multiple of the window size, so two windows are equal or disjoint', () => {
        for (const root of roots) {
            assert.equal((windowStart(root) - QUIET_FIRST) % WINDOW_SIZE, 0);
        }
    });

    it('spreads checkouts over the windows instead of piling them on a few', () => {
        const distinct = new Set(roots.slice(0, 40).map((root) => windowStart(root)));

        assert.ok(
            distinct.size >= 25,
            `only ${String(distinct.size)} distinct windows for 40 checkouts`
        );
    });

    it('defaults to the checkout it runs in', () => {
        assert.equal(windowStart(), windowStart(process.cwd()));
    });
});

describe('quietPort', () => {
    const root = '/work/checkout-a';

    it('puts a lane inside the checkout window', () => {
        for (const [lane, { size }] of Object.entries(LANES)) {
            for (const index of [0, size - 1]) {
                const port = quietPort(lane, index, root);

                assert.ok(port >= windowStart(root), `${lane}[${String(index)}] = ${String(port)}`);
                assert.ok(
                    port < windowStart(root) + WINDOW_SIZE,
                    `${lane}[${String(index)}] = ${String(port)}`
                );
            }
        }
    });

    it('keeps the lanes of one checkout apart, because `node --test` runs files in parallel', () => {
        const taken = new Set();
        for (const [lane, { size }] of Object.entries(LANES)) {
            for (let index = 0; index < size; index += 1) {
                const port = quietPort(lane, index, root);

                assert.equal(taken.has(port), false, `${lane}[${String(index)}] = ${String(port)}`);
                taken.add(port);
            }
        }
    });

    it('defaults to the first port of the lane in the current checkout', () => {
        assert.equal(quietPort('probe'), windowStart() + LANES.probe.offset);
    });

    it('moves a lane with the checkout', () => {
        const other = roots.find((candidate) => windowStart(candidate) !== windowStart(root));

        assert.notEqual(quietPort('probe', 0, other), quietPort('probe', 0, root));
    });

    it('refuses a lane nobody registered, so a new test file cannot borrow one by accident', () => {
        assert.throws(() => quietPort('no-such-lane', 0, root), RangeError);
    });

    it('refuses an index past the lane, which would reach into the next one', () => {
        const { size } = LANES.probe;

        assert.throws(() => quietPort('probe', size, root), RangeError);
        assert.throws(() => quietPort('probe', -1, root), RangeError);
    });
});
