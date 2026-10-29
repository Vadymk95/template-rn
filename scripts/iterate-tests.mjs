#!/usr/bin/env node
/**
 * iterate-tests - the iterate chain's test leg: jest on the tests the working tree reaches, or on the
 * whole suite when what changed is a file jest cannot trace.
 *
 * `jest --onlyChanged` selects tests by walking imports from the changed files. A file that every test
 * runs under and that no test imports (the jest block inside package.json, the Babel config, the setup
 * file, the TypeScript config, the NativeWind and Metro configs) reaches no test through that walk: the
 * selection is empty, and `--passWithNoTests` turns an empty selection into exit 0, so a broken config
 * went green on the iterate chain and red at the push. When one of WIDENING_PATHS differs from HEAD
 * (staged or not, untracked, deleted or renamed away), jest runs the whole suite instead. The same
 * goes when git cannot say what changed: the wide run is the safe one. It drops `--passWithNoTests`,
 * so a config that makes jest find no test at all fails there instead of passing.
 *
 * A file in this list is one jest reads for every test. iterate-tests.test.mjs fails a path that no
 * longer exists and a setup file the jest block names but this list does not.
 *
 * Usage (from the repository root): node scripts/iterate-tests.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';

import { isEntryPoint } from './is-entry-point.mjs';

export const WIDENING_PATHS = Object.freeze([
    'package.json',
    'babel.config.js',
    'metro.config.js',
    'tailwind.config.js',
    'global.css',
    'tsconfig.json',
    'src/test/setup.ts'
]);

const NARROW_ARGS = Object.freeze(['--onlyChanged', '--passWithNoTests']);
const WIDE_ARGS = Object.freeze([]);

// The environment a git hook hands down names the hook's repository; a child `git` that inherited it
// would answer for that repository instead of the working directory.
const gitEnv = () =>
    Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

const git = (cwd, args) =>
    execFileSync('git', args, {
        cwd,
        env: gitEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });

const nulSeparated = (output) => output.split('\0').filter((name) => name !== '');

/** Every path that differs from HEAD (staged or not; deleted ones and both sides of a rename included) and every untracked one, sorted, relative to `cwd`. Throws when git cannot answer. */
export const changedPaths = ({ cwd }) => {
    git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    const tracked = nulSeparated(
        git(cwd, ['diff', '--name-only', '--no-renames', '--relative', '-z', 'HEAD', '--'])
    );
    const untracked = nulSeparated(git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']));

    return [...new Set([...tracked, ...untracked])].sort();
};

/** The jest arguments for the working tree at `cwd`, and the reason printed with them. */
export const planJest = ({ cwd }) => {
    let paths;
    try {
        paths = changedPaths({ cwd });
    } catch {
        return {
            args: [...WIDE_ARGS],
            reason: 'git could not list the changes, so jest runs the whole suite'
        };
    }
    const trigger = WIDENING_PATHS.find((path) => paths.includes(path));
    if (trigger !== undefined) {
        return {
            args: [...WIDE_ARGS],
            reason: `${trigger} changed and no test imports it, so jest runs the whole suite`
        };
    }

    return {
        args: [...NARROW_ARGS],
        reason: 'jest runs the tests the changes reach (--onlyChanged)'
    };
};

// A run that left no exit status either never started (npx is not on the PATH) or was ended by a
// signal. Nothing else reports which, and the exit code alone would hide it.
const stopCause = (result) =>
    result.error
        ? `the jest run could not start: ${result.error.message}`
        : `the jest run was stopped by signal ${result.signal}`;

const main = () => {
    const { args, reason } = planJest({ cwd: process.cwd() });
    console.log(`iterate-tests: ${reason}`);
    const result = spawnSync('npx', ['--no-install', 'jest', ...args], { stdio: 'inherit' });
    if (result.status === null) {
        console.error(`iterate-tests: ${stopCause(result)}`);
    }
    process.exit(result.status ?? 1);
};

// Guarded so importing this module for a test does not run jest.
if (isEntryPoint(import.meta.url)) {
    main();
}
