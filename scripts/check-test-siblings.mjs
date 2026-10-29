#!/usr/bin/env node
// TDD-gate (deterministic): every changed src LOGIC file must have a co-located
// *.test.* sibling. Enforces "tests EXIST" — not "tests-first" (ordering can't be
// hook-forced; that stays an advisory practice). Blocks the commit (exit 1) on a
// missing sibling so a model that skips tests cannot land untested logic.
//
// Changed-only by design, so it RATCHETS: files already in the tree without a
// sibling are not retroactively broken, but the next edit to one demands a test.
//
// Two places ask, with two different sources of truth, and neither is the working tree:
//   - staged mode (pre-commit): the changed files are the staged ones and a sibling counts only
//     when it is in the git INDEX. A test that sits untracked on disk is not part of the commit,
//     so it must not satisfy the gate for a commit that leaves it behind.
//   - range mode (inside `verify`, so pre-push and CI): the changed files are the ones `base...head`
//     added, copied, renamed or modified, and a sibling counts only when it is in the HEAD tree.
//     This is what catches a commit made with the hook skipped or a PR from a clone that never
//     had the hook installed.
//
// Usage:
//   node scripts/check-test-siblings.mjs                 # staged files vs the index (pre-commit)
//   node scripts/check-test-siblings.mjs --range         # base...HEAD vs the HEAD tree (inside verify)
//       [--base <ref>] [--head <ref>]
//   node scripts/check-test-siblings.mjs <file> [file…]  # given files vs the disk (for tests)
//
// Range base, same rule as scripts/check-lock-age.mjs: the merge-base of HEAD with origin/master
// (or origin/main) on a developer machine, so a push is judged on everything it adds; `HEAD~1`
// when CI is set (the PR merge commit's first parent, which needs `fetch-depth: 2`); `--base`
// overrides. The first commit of a repository has nothing to compare with and passes with a note,
// staged (no HEAD yet) or in a range (no base): a project made with "Use this template" starts as
// one commit holding the whole template, and the ratchet starts at its next change. A shallow clone
// that hides the parent is an ERROR, because passing there would be a silent skip.
//
// Exit: 0 clean · 1 a changed source file has no sibling · 2 the gate could not decide.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { isEntryPoint } from './is-entry-point.mjs';

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

const BASE_CANDIDATES = ['origin/master', 'origin/main'];

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

// A hook chain exports these, and a child git that inherits them answers for the repository they
// name instead of the one at `cwd`. GIT_INDEX_FILE stays: it is not a location, and pre-commit
// relies on it to point at the index of the commit being made.
const GIT_LOCATION_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR'];

const gitEnvironment = (environment) =>
    Object.fromEntries(
        Object.entries(environment).filter(([key]) => !GIT_LOCATION_VARIABLES.includes(key))
    );

/** git(args) -> stdout, or null when the command fails. */
const makeGit =
    (cwd, environment = process.env) =>
    (args) => {
        try {
            return execFileSync('git', args, {
                cwd,
                env: gitEnvironment(environment),
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
                maxBuffer: 256 * 1024 * 1024
            });
        } catch {
            return null;
        }
    };

const nulList = (output) => output.split('\0').filter(Boolean);

const CHANGED = ['--name-only', '-z', '--diff-filter=ACMR'];

/**
 * Staged files and an `exists` that answers from the index; `{ root: true }` before the first
 * commit, when there is nothing to compare with.
 */
export const readStaged = (git) => {
    const changed = git(['diff', '--cached', ...CHANGED]);
    const tracked = git(['ls-files', '-z']);
    if (changed === null || tracked === null) {
        return { error: 'cannot read the git index: is this a git repository?' };
    }
    // No HEAD means no commit yet: everything staged is new, a fork's first commit carries the whole
    // template, and judging it would fail on every starter file that has no sibling.
    if (git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']) === null) {
        return { root: true };
    }
    const inIndex = new Set(nulList(tracked));
    return {
        files: nulList(changed),
        exists: (file) => inIndex.has(file),
        subject: 'staged source files'
    };
};

/**
 * Picks the commit the range starts from. Returns { ref }, { root: true } when there is no commit
 * to compare with, or { error }.
 */
export const pickBase = ({ git, env, baseRef }) => {
    const line = (args) => git(args)?.trim() ?? null;
    const isCommit = (ref) =>
        line(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null;

    if (baseRef) {
        return isCommit(baseRef)
            ? { ref: baseRef }
            : { error: `--base ${baseRef} is not a commit in this repository` };
    }

    let ref = null;
    if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') {
        ref = isCommit('HEAD~1') ? 'HEAD~1' : null;
    } else {
        for (const candidate of BASE_CANDIDATES) {
            const mergeBase = line(['merge-base', 'HEAD', candidate]);
            if (mergeBase && isCommit(mergeBase)) {
                ref = mergeBase;
                break;
            }
        }
        if (!ref && isCommit('HEAD~1')) {
            ref = 'HEAD~1';
        }
    }
    if (ref) {
        return { ref };
    }
    if (line(['rev-parse', '--is-shallow-repository']) === 'true') {
        return {
            error: 'shallow clone with no parent commit to compare with: check out with `fetch-depth: 2` (actions/checkout) or run `git fetch --deepen=1`'
        };
    }
    return { root: true };
};

/** Files changed in base...head and an `exists` that answers from the head tree. */
export const readRange = ({ git, env, baseRef, headRef }) => {
    const head = headRef ?? 'HEAD';
    if (git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`]) === null) {
        return { error: `--head ${head} is not a commit in this repository` };
    }
    const base = pickBase({ git, env, baseRef });
    if (base.error || base.root) {
        return base;
    }
    const spec = [`${base.ref}...${head}`];
    const changed = git(['diff', ...CHANGED, ...spec]);
    const tree = git(['ls-tree', '-r', '-z', '--name-only', head]);
    if (changed === null || tree === null) {
        return { error: `cannot read the range ${spec.join(' ')}` };
    }
    const inHead = new Set(nulList(tree));
    return {
        files: nulList(changed),
        exists: (file) => inHead.has(file),
        subject: `source files changed in ${spec.join(' ')}`
    };
};

const parseArguments = (argv) => {
    const parsed = { range: false, base: null, head: null, files: [] };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--range') {
            parsed.range = true;
        } else if (argument === '--base' || argument === '--head') {
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) {
                return { error: `${argument} needs a ref` };
            }
            parsed[argument.slice(2)] = value;
            index += 1;
        } else if (argument.startsWith('--')) {
            return { error: `unknown option ${argument}` };
        } else {
            parsed.files.push(argument);
        }
    }
    return parsed;
};

const fail = (message) => {
    console.error(`\n✖ TDD-gate: ${message}\n`);
    process.exit(2);
};

const main = () => {
    const args = parseArguments(process.argv.slice(2));
    if (args.error) {
        fail(args.error);
    }

    let source;
    if (args.files.length > 0) {
        source = { files: args.files, exists: existsSync, subject: 'source files' };
    } else {
        const git = makeGit(process.cwd());
        source = args.range
            ? readRange({ git, env: process.env, baseRef: args.base, headRef: args.head })
            : readStaged(git);
    }
    if (source.error) {
        fail(source.error);
    }
    if (source.root) {
        console.log('TDD-gate: first commit of the repository, nothing to compare with.');
        return;
    }

    const missing = findMissingSiblings(source.files, source.exists);
    if (missing.length === 0) {
        return;
    }

    console.error(`\n✖ TDD-gate: ${source.subject} with no co-located *.test.* sibling:`);
    for (const file of missing) {
        const ext = file.endsWith('.tsx') ? 'tsx' : 'ts';
        console.error(`  - ${file}  → add ${file.replace(/\.(ts|tsx)$/, `.test.${ext}`)}`);
    }
    console.error(
        '\nTests must exist alongside source, and be part of the change (staged, or tracked at HEAD). Add the test, or if genuinely exempt extend EXEMPT in scripts/check-test-siblings.mjs.\n'
    );
    process.exit(1);
};

// Guarded so importing this module for a test does not shell out to git.
if (isEntryPoint(import.meta.url)) {
    main();
}
