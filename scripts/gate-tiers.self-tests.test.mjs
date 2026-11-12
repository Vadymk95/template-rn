// The list of harness tests a push may leave out (`selfTests` in scripts/gate-tiers.json) is data
// that a wrong edit turns into a silent hole: a name that matches no file leaves nothing out, a
// test that reads the real repository left out of a push stops guarding it. These cases hold the
// list to its rules; the proof that each listed file reads nothing outside scripts/ and temp
// folders is made once per file when it is added, and is part of the pull request that adds it.
//
// Runner: `node:test`, like the other gate specs here. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { findTestFiles, readSelfTests, testArguments } from './test-scripts.mjs';

const TEST_FILE = /^scripts\/[^/]+\.test\.mjs$/;

/**
 * What is wrong with the list in the repository at `cwd`: a name that is not a test file under
 * scripts/, a file that is not there, a name listed twice, and a runner that leaves out anything but
 * the list.
 */
const problemsOf = (cwd) => {
    const listed = readSelfTests(cwd);
    const problems = [];
    if (listed.length === 0) problems.push('the list is missing or empty');
    for (const file of listed) {
        if (!TEST_FILE.test(file)) problems.push(`${file} is not a test file under scripts/`);
        else if (!existsSync(path.join(cwd, file))) problems.push(`${file} does not exist`);
    }
    for (const file of new Set(listed)) {
        if (listed.filter((other) => other === file).length > 1) {
            problems.push(`${file} is listed twice`);
        }
    }
    // Every listed name must be a file `node --test` would run, so leaving the list out takes away
    // exactly as many files as the list holds.
    const found = findTestFiles(cwd);
    const kept = testArguments({ found, listed, leaveOut: true }).slice(1);
    if (kept.length !== found.length - new Set(listed).size) {
        problems.push('the runner leaves out something other than the list');
    }
    return problems;
};

describe('the list of harness tests a push may leave out', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    const fixture = (files, present = [...files, 'scripts/other.test.mjs']) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'self-tests-list-'));
        dirs.push(dir);
        mkdirSync(path.join(dir, 'scripts'));
        writeFileSync(
            path.join(dir, 'scripts/gate-tiers.json'),
            JSON.stringify({ selfTests: { files } })
        );
        for (const file of present) writeFileSync(path.join(dir, file), '');
        return dir;
    };

    it('holds in this repository', () => {
        assert.deepEqual(problemsOf(process.cwd()), []);
    });

    it('accepts a list of files that exist', () => {
        assert.deepEqual(problemsOf(fixture(['scripts/a.test.mjs', 'scripts/b.test.mjs'])), []);
    });

    it('fails a listed file that was removed from disk', () => {
        const dir = fixture(
            ['scripts/a.test.mjs', 'scripts/b.test.mjs'],
            ['scripts/a.test.mjs', 'scripts/other.test.mjs']
        );

        assert.deepEqual(problemsOf(dir), [
            'scripts/b.test.mjs does not exist',
            'the runner leaves out something other than the list'
        ]);
    });

    it('fails a file listed twice', () => {
        const dir = fixture(['scripts/a.test.mjs', 'scripts/a.test.mjs']);

        assert.ok(problemsOf(dir).includes('scripts/a.test.mjs is listed twice'));
    });

    it('fails a name that is not a test file under scripts/', () => {
        const dir = fixture(['scripts/a.mjs', 'src/a.test.ts'], ['scripts/a.mjs']);

        assert.deepEqual(problemsOf(dir).slice(0, 2), [
            'scripts/a.mjs is not a test file under scripts/',
            'src/a.test.ts is not a test file under scripts/'
        ]);
    });

    it('fails an empty or missing list', () => {
        assert.ok(problemsOf(fixture([])).includes('the list is missing or empty'));
    });
});

// The push hook is where the marker is set. Without it every push runs everything and prints
// nothing about it: the saving would be off in silence.
const HOOK = '.husky/pre-push';
const GATE_COMMAND = 'npm run verify:ci';
const MARKER = 'GATE_PUSH=1';

/** What is wrong with the push hook of the repository at `cwd`: no gate command, or one without the marker. */
const hookProblemsOf = (cwd) => {
    let text;
    try {
        text = readFileSync(path.join(cwd, HOOK), 'utf8');
    } catch {
        return [`${HOOK} cannot be read`];
    }
    const gate = text
        .split('\n')
        .find((line) => !line.trimStart().startsWith('#') && line.includes(GATE_COMMAND));
    if (gate === undefined) return [`${HOOK} does not run ${GATE_COMMAND}`];
    return gate.includes(`${MARKER} ${GATE_COMMAND}`)
        ? []
        : [`${HOOK} does not set ${MARKER} on the gate command`];
};

describe('the push hook sets the marker', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    const withHook = (text) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'push-hook-'));
        dirs.push(dir);
        mkdirSync(path.join(dir, '.husky'));
        if (text !== undefined) writeFileSync(path.join(dir, '.husky/pre-push'), text);
        return dir;
    };

    it('holds in this repository', () => {
        assert.deepEqual(hookProblemsOf(process.cwd()), []);
    });

    it('accepts a hook whose gate command carries the marker', () => {
        const dir = withHook(
            '#!/usr/bin/env sh\nif ! GATE_PUSH=1 npm run verify:ci; then\n    exit 1\nfi\n'
        );

        assert.deepEqual(hookProblemsOf(dir), []);
    });

    it('fails a hook whose gate command lacks the marker', () => {
        const dir = withHook('#!/usr/bin/env sh\nif ! npm run verify:ci; then\n    exit 1\nfi\n');

        assert.deepEqual(hookProblemsOf(dir), [
            '.husky/pre-push does not set GATE_PUSH=1 on the gate command'
        ]);
    });

    it('fails a hook that names the marker only in a comment', () => {
        const dir = withHook('# GATE_PUSH=1 npm run verify:ci\nnpm run verify:ci || exit 1\n');

        assert.deepEqual(hookProblemsOf(dir), [
            '.husky/pre-push does not set GATE_PUSH=1 on the gate command'
        ]);
    });

    it('fails a hook that does not run the gate at all', () => {
        const dir = withHook('#!/usr/bin/env sh\nexit 0\n');

        assert.deepEqual(hookProblemsOf(dir), ['.husky/pre-push does not run npm run verify:ci']);
    });

    it('fails a hook that is missing', () => {
        assert.deepEqual(hookProblemsOf(withHook(undefined)), ['.husky/pre-push cannot be read']);
    });
});
