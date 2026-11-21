#!/usr/bin/env node
/**
 * The `test:scripts` stage: the node:test specs of the gate scripts, `node --test "scripts/**\/*.test.mjs"`.
 * Every spec file runs on every run: a push, `npm run verify` and CI all start this one command, and
 * nothing is left out by what the diff touched. (`npm test` is jest and runs no script test.)
 *
 * NODE_TEST_CONCURRENCY caps how many spec files node runs at once (`--test-concurrency=<n>`). Node reads
 * no cap from its environment on its own, so this is where a lane, or the gatelaw canary, passes the
 * worker cap that every test run names (VITEST_MAX_WORKERS does the same job for vitest). Unset or empty
 * it is the plain command with node's own default. Anything else that is not a positive whole number
 * stops the run: a cap that is misspelled must never read as no cap.
 */
import { spawnSync } from 'node:child_process';

import { isEntryPoint } from './is-entry-point.mjs';

export const TEST_PATTERN = 'scripts/**/*.test.mjs';
export const CAP_VARIABLE = 'NODE_TEST_CONCURRENCY';

/** The arguments of the `node` that runs the specs; throws for a cap that is not a positive whole number. */
export const testArguments = (env = process.env) => {
    const cap = env[CAP_VARIABLE];
    if (cap === undefined || cap === '') return ['--test', TEST_PATTERN];
    if (!/^[1-9]\d*$/.test(cap)) {
        throw new Error(
            `${CAP_VARIABLE}="${cap}" is not a positive whole number. Unset it for no cap, or give the number of spec files to run at once.`
        );
    }
    return ['--test', `--test-concurrency=${cap}`, TEST_PATTERN];
};

/** Starts the specs and returns the exit code; a child killed by a signal cannot pass. */
export const run = ({ env = process.env, spawn = spawnSync } = {}) => {
    const result = spawn(process.execPath, testArguments(env), { stdio: 'inherit', shell: false });
    // The verdict reads status BEFORE normalisation, so a child killed by a signal cannot pass.
    return result.status ?? 1;
};

if (isEntryPoint(import.meta.url)) {
    try {
        process.exitCode = run();
    } catch (error) {
        console.error(
            `\n✖ test:scripts: ${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
    }
}
