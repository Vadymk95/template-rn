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

const isSrcLogic = (f) => /^src\/.+\.(ts|tsx)$/.test(f) && !EXEMPT.test(f);

const argvFiles = process.argv.slice(2);
const files = argvFiles.length
    ? argvFiles
    : execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean);

const missing = [];
for (const f of files) {
    if (!isSrcLogic(f)) continue;
    const base = f.replace(/\.(ts|tsx)$/, '');
    if (!existsSync(`${base}.test.ts`) && !existsSync(`${base}.test.tsx`)) {
        missing.push(f);
    }
}

if (missing.length) {
    console.error('\n✖ TDD-gate: staged source files with no co-located *.test.* sibling:');
    for (const m of missing) {
        const ext = m.endsWith('.tsx') ? 'tsx' : 'ts';
        console.error(`  - ${m}  → add ${m.replace(/\.(ts|tsx)$/, `.test.${ext}`)}`);
    }
    console.error(
        '\nTests must exist alongside source. Add the test, or if genuinely exempt extend EXEMPT in scripts/check-test-siblings.mjs.\n'
    );
    process.exit(1);
}
