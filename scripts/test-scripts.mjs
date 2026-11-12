#!/usr/bin/env node
/**
 * The `test:scripts` stage: the node:test specs of the gate scripts.
 *
 * Without GATE_PUSH=1, or under CI, this starts exactly `node --test "scripts/**\/*.test.mjs"` (the
 * command this stage used to be) and passes its exit code on. `npm run test:scripts` without the
 * marker, `npm run verify` and CI never leave anything out (`npm test` is jest and runs no script test).
 *
 * One exception to "never shortened by what the diff touched": the harness's own tests that read
 * nothing outside the harness (gate-tiers.json, `selfTests`) are left out of a push that changes no
 * harness file (a path of gate-files.json or under scripts/, package.json or the lockfile). The
 * pre-push hook says it is a push by setting GATE_PUSH=1; this script then decides, once, from the
 * paths between the merge base with the remote branch and HEAD. Anything that cannot be told (a
 * package below the repository root too), CI and `GATE_SELF_TESTS=all` run them all. Every push
 * prints which way it went.
 *
 * GATE_PUSH=1 set by hand (`GATE_PUSH=1 npm run verify:ci`) behaves as a push, on purpose: it is
 * how the push gate is tried without pushing.
 */
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { MANIFEST_PATH, matchesGlob } from './check-gate-integrity.mjs';
import { FALLBACK_BASE, isCi, makeGit, pickBase } from './check-test-siblings.mjs';
import { isEntryPoint } from './is-entry-point.mjs';

export const PUSH_MARKER = 'GATE_PUSH';
export const TEST_PATTERN = 'scripts/**/*.test.mjs';

const OVERRIDE_VARIABLE = 'GATE_SELF_TESTS';
const ALWAYS_HARNESS = new Set(['package.json', 'package-lock.json']);

/** The harness tests a push may leave out; empty when the list is missing or malformed. */
export const readSelfTests = (cwd) => {
    try {
        const files = JSON.parse(readFileSync(`${cwd}/scripts/gate-tiers.json`, 'utf8')).selfTests
            ?.files;
        return Array.isArray(files) && files.every((file) => typeof file === 'string') ? files : [];
    } catch {
        return [];
    }
};

/** The harness paths of scripts/gate-files.json; undefined when it cannot be read. */
export const readGateGlobs = (cwd) => {
    try {
        const paths = JSON.parse(readFileSync(`${cwd}/${MANIFEST_PATH}`, 'utf8'))?.paths;
        return Array.isArray(paths) && paths.every((glob) => typeof glob === 'string')
            ? paths
            : undefined;
    } catch {
        return undefined;
    }
};

/**
 * The paths this push changes: between the merge base of HEAD with the remote default branch (the
 * base `check-test-siblings --range` uses) and HEAD, a deleted path and both sides of a rename
 * included. { paths }, or { why } when it cannot be told.
 */
export const readPushChange = ({ cwd, env, git = makeGit(cwd) }) => {
    const base = pickBase({ git, env });
    if (!base.ref || base.ref === FALLBACK_BASE) {
        return { why: 'no merge base with origin/master or origin/main' };
    }
    // `git diff` names paths from the repository root; the harness globs are relative to the package.
    if (git(['rev-parse', '--show-prefix'])?.trim() !== '') {
        return { why: 'the package is not at the repository root, or git could not say' };
    }
    const out = git(['diff', '--name-only', '-z', '--no-renames', base.ref, 'HEAD']);
    return out === null
        ? { why: 'git could not list the changed paths' }
        : { paths: out.split('\0').filter(Boolean) };
};

/** Whether the listed self-tests are left out of this push; `readChange` is only called when it matters. */
export const decideSelfTests = ({ env, listed, globs, readChange }) => {
    const run = (reason) => ({ leaveOut: false, reason });
    const override = env[OVERRIDE_VARIABLE];
    if (override !== undefined && override !== '' && override !== 'all') {
        throw new Error(
            `${OVERRIDE_VARIABLE}="${override}" is not an override. The only value is all (unset or empty means none) — an unknown value must not silently leave tests out.`
        );
    }
    if (override === 'all') return run(`${OVERRIDE_VARIABLE}=all`);
    if (isCi(env)) return run('CI is set');
    if (listed.length === 0) return run('scripts/gate-tiers.json lists no test to leave out');
    if (globs === undefined) return run(`${MANIFEST_PATH} cannot be read`);
    const change = readChange();
    if (change.why !== undefined) return run(`cannot tell what this push changes: ${change.why}`);
    const harness = change.paths.filter(
        (file) =>
            ALWAYS_HARNESS.has(file) ||
            file.startsWith('scripts/') ||
            globs.some((glob) => matchesGlob(glob, file))
    );
    if (harness.length === 0) return { leaveOut: true, reason: '' };
    const more = harness.length > 1 ? ` and ${String(harness.length - 1)} more` : '';
    return run(`harness path changed: ${harness[0]}${more}`);
};

export const describeSelfTests = ({ leaveOut, reason }, count) =>
    leaveOut
        ? `── push gate: ${String(count)} harness self-tests left out (this push changes no harness file; CI runs them; ${OVERRIDE_VARIABLE}=all git push runs them here) ──`
        : `── push gate: all harness self-tests run (${reason}) ──`;

/**
 * The test files `node --test` runs for the pattern: the same glob it expands, and it skips a
 * `node_modules` folder at any depth. scripts/test-scripts.test.mjs proves the sets equal.
 */
export const findTestFiles = (cwd) =>
    globSync(TEST_PATTERN, {
        cwd,
        exclude: (entry) =>
            (typeof entry === 'string' ? path.basename(entry) : entry.name) === 'node_modules'
    }).map((file) => file.split(path.sep).join('/'));

/**
 * The arguments of the `node` that runs the specs. Without a decision to leave tests out it is the
 * old command, the pattern left for node to expand; with one it names the found files minus the
 * listed ones (node has no flag that excludes a file). If that leaves nothing, node would fall back
 * to finding every file itself, so the whole pattern is said outright.
 */
export const testArguments = ({ found, listed, leaveOut }) => {
    if (!leaveOut) return ['--test', TEST_PATTERN];
    const kept = found.filter((file) => !listed.includes(file));
    return kept.length === 0 ? ['--test', TEST_PATTERN] : ['--test', ...kept];
};

const main = () => {
    const env = process.env;
    const cwd = process.cwd();
    let args = testArguments({ found: [], listed: [], leaveOut: false });

    if (env[PUSH_MARKER] === '1') {
        const listed = readSelfTests(cwd);
        const decision = decideSelfTests({
            env,
            listed,
            globs: readGateGlobs(cwd),
            readChange: () => readPushChange({ cwd, env })
        });
        console.log(describeSelfTests(decision, listed.length));
        args = testArguments({ found: findTestFiles(cwd), listed, leaveOut: decision.leaveOut });
    }

    const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
    // The verdict reads status BEFORE normalisation, so a child killed by a signal cannot pass.
    process.exit(result.status ?? 1);
};

if (isEntryPoint(import.meta.url)) {
    try {
        main();
    } catch (error) {
        console.error(
            `\n✖ test:scripts: ${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exit(1);
    }
}
