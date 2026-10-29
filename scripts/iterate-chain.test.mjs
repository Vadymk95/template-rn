// The iterate chain is data in package.json (`verify:iter:inner`), and docs:check keeps its readable view in
// gate-tiers.json equal to it. Nothing says WHICH stages it has to hold, so a stage dropped from both stays
// consistent and silent. Three were once missing, each for a reason that is easy to forget:
//   - ESLint on the changed files: oxlint has no types, so type-aware findings reached the commit hook first;
//   - the layer-scope test by name: it reads configs as text, nothing imports it, `--onlyChanged` never selects it;
//   - the test leg that runs the whole suite when a config jest cannot trace is dirty: a raw
//     `jest --onlyChanged --passWithNoTests` selects nothing for such a change and exits 0.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
const iterateSteps = scripts['verify:iter:inner'].split(/\s+&&\s+/);

describe('the iterate chain', () => {
    it('lints the changed files with ESLint, after the type check', () => {
        const lint = iterateSteps.indexOf('node scripts/lint-changed.mjs');
        const typecheck = iterateSteps.indexOf('npm run typecheck');

        assert.ok(lint > -1, 'node scripts/lint-changed.mjs is not a step');
        assert.ok(typecheck > -1, 'npm run typecheck is not a step');
        assert.ok(lint > typecheck, 'the ESLint leg runs before the type check');
        assert.equal(existsSync('scripts/lint-changed.mjs'), true);
    });

    it('runs the layer-scope test by name, because `--onlyChanged` never selects it', () => {
        const scope = 'scripts/mutation-scope.test.mjs';

        assert.ok(iterateSteps.includes(`node ${scope}`), `${scope} is not a step`);
        assert.equal(existsSync(scope), true);
    });

    it('selects tests through the step that widens to the whole suite on a dirty config', () => {
        const selection = iterateSteps.indexOf('node scripts/iterate-tests.mjs');

        assert.ok(selection > -1, 'node scripts/iterate-tests.mjs is not a step');
        assert.equal(existsSync('scripts/iterate-tests.mjs'), true);
        // A raw jest step beside it would bring the empty selection back for a config change.
        assert.deepEqual(
            iterateSteps.filter((step) => /(^|\s)jest(\s|$)/.test(step)),
            []
        );
    });
});
