// What the lint configuration promises and nothing else checks, against the real linter: it leaves
// `.cursor/` alone, so an agent's scratch script there cannot red `npm run lint` or the iterate chain's
// ESLint leg (`lint-changed.mjs` lints untracked files too). oxlint needs no case of its own: its script
// reads `src` only.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ESLint } from 'eslint';

// Loading the whole repository config is the cost; the suite runs this next to dozens of other
// files, so the default limit would measure machine load, not the code.
describe('the agent scratch folder `.cursor/`', { timeout: 60_000 }, () => {
    it('ESLint ignores it, and still lints the same path anywhere else', async () => {
        const eslint = new ESLint({ cwd: process.cwd() });

        assert.equal(await eslint.isPathIgnored('scripts/probe.mjs'), false, 'outside .cursor/');
        assert.equal(await eslint.isPathIgnored('src/probe.ts'), false, 'a source file');
        assert.equal(
            await eslint.isPathIgnored('.cursor/probe.mjs'),
            true,
            'at the top of .cursor/'
        );
        assert.equal(
            await eslint.isPathIgnored('.cursor/plans/deep/probe.mjs'),
            true,
            'deeper under .cursor/'
        );
    });
});
