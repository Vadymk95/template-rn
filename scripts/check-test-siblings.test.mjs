// The EXEMPT list is the part of this gate people actually edit, and every edit
// widens it — usually to get one commit moving. These cases pin what the exemptions
// are FOR, so a widening that changes the policy fails here instead of silently
// letting untested logic land.
//
// Runner: `node:test`, for the same reason as the other gate specs here — Jest 29
// neither discovers `.mjs` nor loads real ESM without --experimental-vm-modules, and
// keeping these out of `collectCoverageFrom` stops gate tooling from moving the app's
// coverage thresholds. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findMissingSiblings, isSrcLogic } from './check-test-siblings.mjs';

const nothingExists = () => false;

describe('isSrcLogic', () => {
    for (const file of [
        'src/lib/utils.ts',
        'src/lib/secureToken.ts',
        'src/hooks/useStoreReady.ts',
        'src/store/todo/todoStore.ts',
        'src/features/todo/useTodoWorkspace.ts',
        'src/widgets/todo-workspace/TodoList.tsx',
        'src/shared/ui/Card/Card.tsx'
    ]) {
        it(`treats ${file} as logic that needs a test`, () => {
            assert.equal(isSrcLogic(file), true);
        });
    }

    for (const [label, file] of [
        ['a test file', 'src/lib/utils.test.ts'],
        ['a type declaration', 'src/types/global.d.ts'],
        ['a barrel', 'src/features/todo/index.ts'],
        ['a constants table', 'src/store/todo/constants.ts'],
        ['a types-only module', 'src/features/todo/types.ts'],
        ['a storage-key registry', 'src/lib/storageKeys.ts'],
        ['validated env', 'src/env.ts'],
        ['a storybook story', 'src/shared/ui/Card/Card.stories.tsx'],
        ['a template seed', 'src/lib/api/_exampleSafeQuery.ts'],
        // Expo Router shells and infrastructure, all excluded from coverage too.
        ['a router screen', 'src/app/(tabs)/index.tsx'],
        ['the root layout', 'src/app/_layout.tsx'],
        ['test setup', 'src/test/setup.ts'],
        ['a declarative constants table', 'src/shared/lib/constants/routes.ts'],
        ['i18n bootstrap glue', 'src/shared/lib/i18n/index.ts'],
        ['a locale bundle module', 'src/shared/locales/en/common.ts']
    ]) {
        it(`exempts ${label}`, () => {
            assert.equal(isSrcLogic(file), false);
        });
    }

    it('does NOT exempt the theme token modules', () => {
        // Deliberate: they are in the coverage report and `colors.ts` exports a real
        // function. Adding `^src/shared/lib/theme/` to EXEMPT to move a commit along
        // is exactly what this case is here to stop.
        assert.equal(isSrcLogic('src/shared/lib/theme/colors.ts'), true);
        assert.equal(isSrcLogic('src/shared/lib/theme/spacing.ts'), true);
    });

    it('ignores files outside src entirely', () => {
        assert.equal(isSrcLogic('scripts/audit-gate.mjs'), false);
        assert.equal(isSrcLogic('app.config.ts'), false);
        assert.equal(isSrcLogic('metro.config.js'), false);
    });

    it('ignores non-TypeScript files under src', () => {
        assert.equal(isSrcLogic('src/shared/locales/en/common.json'), false);
    });

    it('does not exempt a nested directory that reuses an exempt name', () => {
        // Every `^src/...` exemption is anchored on purpose. Each path below contains
        // the segment somewhere OTHER than the start, which is what makes these cases
        // catch an un-anchoring.
        assert.equal(isSrcLogic('src/features/editor/app/Screen.tsx'), true);
        assert.equal(isSrcLogic('src/features/editor/test/helpers.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/lib/constants/local.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/lib/i18n/keys.ts'), true);
        assert.equal(isSrcLogic('src/features/editor/shared/locales/en.ts'), true);
    });

    it('does not exempt a filename that merely starts with an exempt name', () => {
        assert.equal(isSrcLogic('src/lib/constantsFactory.ts'), true);
        assert.equal(isSrcLogic('src/features/todo/typesGuard.ts'), true);
        assert.equal(isSrcLogic('src/lib/storageKeysMigration.ts'), true);
    });
});

describe('findMissingSiblings', () => {
    it('reports a logic file with no sibling', () => {
        assert.deepEqual(findMissingSiblings(['src/lib/utils.ts'], nothingExists), [
            'src/lib/utils.ts'
        ]);
    });

    it('accepts a .ts file covered by a .test.ts sibling', () => {
        const exists = (path) => path === 'src/lib/utils.test.ts';

        assert.deepEqual(findMissingSiblings(['src/lib/utils.ts'], exists), []);
    });

    it('accepts a .tsx file covered by a .test.tsx sibling', () => {
        const exists = (path) => path === 'src/shared/ui/Card/Card.test.tsx';

        assert.deepEqual(findMissingSiblings(['src/shared/ui/Card/Card.tsx'], exists), []);
    });

    it('passes an empty change set', () => {
        assert.deepEqual(findMissingSiblings([], nothingExists), []);
    });

    it('never reports an exempt file, even with nothing on disk', () => {
        assert.deepEqual(findMissingSiblings(['src/app/_layout.tsx'], nothingExists), []);
    });

    it('reports every offender rather than stopping at the first', () => {
        assert.deepEqual(
            findMissingSiblings(
                ['src/lib/a.ts', 'src/app/_layout.tsx', 'src/lib/b.ts'],
                nothingExists
            ),
            ['src/lib/a.ts', 'src/lib/b.ts']
        );
    });

    it('probes only paths derived from the file under test', () => {
        const probed = [];
        findMissingSiblings(['src/store/todo/todoStore.ts'], (path) => {
            probed.push(path);
            return false;
        });

        assert.deepEqual(probed, [
            'src/store/todo/todoStore.test.ts',
            'src/store/todo/todoStore.test.tsx'
        ]);
    });

    it('is not satisfied by a sibling belonging to a different module', () => {
        assert.deepEqual(
            findMissingSiblings(['src/lib/a.ts'], (path) => path.includes('b.test')),
            ['src/lib/a.ts']
        );
    });
});
