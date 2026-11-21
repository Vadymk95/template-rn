// `docs:check` runs at two moments, the commit hook (staged files) and the iterate chain (the working
// tree against HEAD), and the condition for running it is one regular expression in docs-trigger.mjs.
// A second copy of that pattern in a hook or a package script would drift, so the last cases read the
// hook and package.json as text and fail when either stops going through the script. The first block
// names paths of this repository's layout that must never start the docs check. The rest of the
// cases live in gatelaw.
//
// Runner: `node:test`. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { touchesDocs } from './docs-trigger.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

describe('touchesDocs', () => {
    for (const file of [
        'src/app/(tabs)/index.tsx',
        'src/shared/lib/utils.ts',
        'app.config.ts',
        'src/shared/locales/en/common.json'
    ]) {
        it(`does not run for ${file}`, () => {
            assert.equal(touchesDocs([file]), false);
        });
    }
});

describe('one condition, read by the hook and by the iterate chain', () => {
    const hook = readFileSync('.husky/pre-commit', 'utf8');
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
    const iterate = scripts['verify:iter:inner'];

    it('the hook runs docs:check through the script, staged', () => {
        assert.match(hook, /node scripts\/docs-trigger\.mjs --staged/);
    });

    it('the iterate chain runs docs:check through the same script', () => {
        assert.ok(iterate.split(/\s+&&\s+/).includes('node scripts/docs-trigger.mjs'));
    });

    it('neither keeps a pattern of its own', () => {
        assert.doesNotMatch(hook, /grep\b[^\n]*(?:md|mdc|gate-tiers)/);
        assert.equal(hook.includes('docs-check\\.'), false);
        assert.equal(iterate.includes('gate-tiers'), false);
        assert.equal(existsSync('scripts/docs-trigger.mjs'), true);
    });
});
