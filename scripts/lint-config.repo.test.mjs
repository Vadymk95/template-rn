// What the lint configuration promises and nothing else checks, against the real linter: it leaves
// `.cursor/` alone, so an agent's scratch script there cannot red `npm run lint` or the iterate chain's
// ESLint leg (`lint-changed.mjs` lints untracked files too). oxlint needs no case of its own: its script
// reads `src` only.
//
// Runner: `node:test`, not Jest (`jest.testMatch` in `package.json` keeps `.mjs` gate scripts
// out of Jest). Run via `npm run test:scripts`. The file reads this repository's real ESLint
// configuration, so it stays here when the harness tests move to gatelaw.
import assert from 'node:assert/strict';

import { ESLint } from 'eslint';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

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
