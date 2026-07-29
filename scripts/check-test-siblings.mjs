#!/usr/bin/env node
// TDD-gate (deterministic): every staged src LOGIC file must have a co-located
// *.test.* sibling. Enforces "tests EXIST" — not "tests-first" (ordering can't be
// hook-forced; that stays an advisory practice). Blocks the commit (exit 1) on a
// missing sibling so a model that skips tests cannot land untested logic.
//
// Staged-only by design, so it RATCHETS: files already in the tree without a
// sibling are not retroactively broken, but the next edit to one demands a test.
//
// Usage:
//   node scripts/check-test-siblings.mjs                 # checks staged files (pre-commit)
//   node scripts/check-test-siblings.mjs <file> [file…]  # checks given files (for tests)
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Exempt list derived from THIS repo: the paths Jest already excludes from
// `collectCoverageFrom` (app shell, env, i18n glue, shared constants tables,
// locales, `_example*` seeds, test utils) plus declaration-only modules — tests,
// type decls, barrels, `constants.ts` / `types.ts` / `storageKeys.ts` registries.
//
// NOT exempt on purpose: `src/shared/lib/theme/**`. Those files are in the
// coverage report, and `colors.ts` exports a real function (`getThemeColorValue`)
// whose dark branch is uncovered today. Do not add them to keep a commit moving.
const EXEMPT =
    /(\.test\.[tj]sx?$|\.d\.ts$|\/index\.tsx?$|constants\.ts$|types\.ts$|\/storageKeys\.ts$|\/_example[^/]*$|\/env\.ts$|\.stories\.[tj]sx?$|^src\/app\/|^src\/test\/|^src\/shared\/lib\/constants\/|^src\/shared\/lib\/i18n\/|^src\/shared\/locales\/)/;

export const isSrcLogic = (file) => /^src\/.+\.(ts|tsx)$/.test(file) && !EXEMPT.test(file);

/**
 * Pure decision half, so the EXEMPT list can be tested without a git index or a
 * real tree. `exists` is injected for the same reason: this is the piece most
 * likely to be edited later (usually to widen an exemption), so it is the piece
 * that needs a spec.
 */
export const findMissingSiblings = (files, exists) =>
    files.filter((file) => {
        if (!isSrcLogic(file)) {
            return false;
        }
        const base = file.replace(/\.(ts|tsx)$/, '');
        return !exists(`${base}.test.ts`) && !exists(`${base}.test.tsx`);
    });

const stagedFiles = () =>
    execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);

const main = () => {
    const argvFiles = process.argv.slice(2);
    const missing = findMissingSiblings(argvFiles.length ? argvFiles : stagedFiles(), existsSync);

    if (missing.length === 0) {
        return;
    }

    console.error('\n✖ TDD-gate: staged source files with no co-located *.test.* sibling:');
    for (const file of missing) {
        const ext = file.endsWith('.tsx') ? 'tsx' : 'ts';
        console.error(`  - ${file}  → add ${file.replace(/\.(ts|tsx)$/, `.test.${ext}`)}`);
    }
    console.error(
        '\nTests must exist alongside source. Add the test, or if genuinely exempt extend EXEMPT in scripts/check-test-siblings.mjs.\n'
    );
    process.exit(1);
};

// Guarded so importing this module for a test does not shell out to git.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
