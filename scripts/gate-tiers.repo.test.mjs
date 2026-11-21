// The push hook and scripts/gate-tiers.json name the push by one label: the hook traces the gate run
// under it and the push moment expects it. A label that drifts on one side leaves every push judged
// by no moment at all, which `docs:check` cannot see (it only asks that SOME moment lists the label).
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

/** The label of the traced gate command in the hook text; comment lines do not count. */
const hookLabel = (text) =>
    text
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .map((line) => /gate-trace\.mjs (\S+) --/.exec(line)?.[1])
        .find((label) => label !== undefined);

describe('the push hook', () => {
    it('traces the push under the label the push moment expects', () => {
        const tiers = JSON.parse(
            readFileSync(path.join(process.cwd(), 'scripts/gate-tiers.json'), 'utf8')
        );
        const hook = readFileSync(path.join(process.cwd(), '.husky/pre-push'), 'utf8');

        assert.equal(hookLabel(hook), tiers.moments.push.expected[0]);
    });
});
