// The commit hook must format every file the push gate checks for format. `format:check` runs
// `prettier --check .`, which reads every tracked file prettier has a parser for (and the repo's
// ignore files do not exclude); `lint-staged` formats only the files its globs match. A file in the
// first set and not in the second passes the commit hook unformatted and fails the push. This spec
// closes the class: every tracked file prettier would check must match at least one lint-staged glob.
//
// Runner: `node:test`, like the other gate specs here. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { getFileInfo } from 'prettier';

// picomatch is not a dependency of this repo; lint-staged brings it. Resolving it from lint-staged's
// own location makes the test match with the exact copy lint-staged runs.
const picomatch = createRequire(import.meta.resolve('lint-staged'))('picomatch');

// The git location variables a hook chain exports would point `git ls-files` at the wrong repository.
const GIT_LOCATION_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

const gitEnvironment = () => {
    const env = { ...process.env };

    for (const key of GIT_LOCATION_VARIABLES) delete env[key];

    return env;
};

const trackedFiles = () => {
    const run = spawnSync('git', ['ls-files', '-z'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: gitEnvironment(),
        maxBuffer: 64 * 1024 * 1024
    });

    assert.equal(run.status, 0, run.stderr);

    return run.stdout.split('\0').filter(Boolean);
};

// Same options as `node_modules/lint-staged/lib/matchFiles.js` (lines 10-18): dotfiles match, and a
// pattern without a slash is matched against the file name in every directory (`matchBase`), so
// `*.mjs` matches `scripts/a.mjs`.
const matchesGlob = (pattern, file) =>
    picomatch(pattern, {
        dot: true,
        matchBase: !pattern.includes('/'),
        posixSlashes: true,
        strictBrackets: true
    })(file);

const lintStagedGlobs = () =>
    Object.keys(JSON.parse(readFileSync('package.json', 'utf8'))['lint-staged']);

// The files `prettier --check .` reads: not ignored by `.prettierignore` (or `.gitignore`, which the
// CLI also honours) and with a parser prettier infers from the name.
const prettierChecked = async (files) => {
    const checked = [];

    for (const file of files) {
        const info = await getFileInfo(file, { ignorePath: ['.gitignore', '.prettierignore'] });

        if (!info.ignored && info.inferredParser) checked.push(file);
    }

    return checked;
};

describe('lint-staged covers every file the format check reads', { timeout: 60_000 }, () => {
    it('matches each tracked file prettier checks to at least one glob', async () => {
        const globs = lintStagedGlobs();
        const checked = await prettierChecked(trackedFiles());

        assert.ok(checked.length > 0, 'the format check must read some tracked files');

        const unmatched = checked.filter((file) => !globs.some((glob) => matchesGlob(glob, file)));

        assert.deepEqual(
            unmatched,
            [],
            `the commit hook never formats these files, the push format check reads them: ${unmatched.join(', ')}`
        );
    });

    it('matches a slash-free glob in every directory, as lint-staged does', () => {
        assert.equal(matchesGlob('*.{mjs,cjs}', 'scripts/a.mjs'), true);
        assert.equal(matchesGlob('*.{mjs,cjs}', '.hidden/b.cjs'), true);
        assert.equal(matchesGlob('*.{mjs,cjs}', 'scripts/a.txt'), false);
    });
});

// The commit hook runs oxlint on the staged files of a code glob. oxlint exits 1 with "No files found
// to lint" when every file it is given matches `.oxlintrc.json` `ignorePatterns`, so a commit that
// stages only such files (a root config, a script) would fail the hook for no lint reason. The flag
// below turns that into a clean exit. These cases pick, for each ignore pattern that matches a tracked
// file the oxlint glob selects, one such file, and run the configured command on all of them at once,
// the way lint-staged does.
const UNMATCHED_FLAG = '--no-error-on-unmatched-pattern';
const NO_FILES_MESSAGE = 'No files found to lint';

const lintStagedConfig = () => JSON.parse(readFileSync('package.json', 'utf8'))['lint-staged'];

const oxlintCommands = () => {
    const found = [];

    for (const [glob, commands] of Object.entries(lintStagedConfig())) {
        for (const command of [commands].flat()) {
            if (/^oxlint(\s|$)/.test(command)) found.push({ glob, command });
        }
    }

    return found;
};

// oxlint reads `ignorePatterns` as gitignore lines: a name without a slash matches at any depth, and
// a directory name ignores everything below it.
const matchesIgnorePattern = (pattern, file) =>
    [pattern, `${pattern}/**`].some((candidate) =>
        picomatch(candidate, {
            dot: true,
            matchBase: !pattern.includes('/'),
            posixSlashes: true
        })(file)
    );

const runOxlint = (command, files) => {
    const [, ...flags] = command.split(/\s+/);
    const run = spawnSync('node_modules/.bin/oxlint', [...flags, ...files], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: gitEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    return { status: run.status, output: `${run.stdout}${run.stderr}` };
};

describe(
    'the staged oxlint pass survives a commit of only ignored files',
    { timeout: 60_000 },
    () => {
        const patterns = JSON.parse(
            readFileSync('.oxlintrc.json', 'utf8').replace(/^\s*\/\/.*$/gm, '')
        ).ignorePatterns;

        it('finds an oxlint command in lint-staged', () => {
            assert.ok(oxlintCommands().length > 0, 'lint-staged must run oxlint on some glob');
        });

        for (const { glob, command } of oxlintCommands()) {
            it(`exits 0 for files only ignorePatterns exclude (${glob})`, () => {
                const selected = trackedFiles().filter((file) => matchesGlob(glob, file));
                const sample = [];

                for (const pattern of patterns) {
                    const match = selected.find((file) => matchesIgnorePattern(pattern, file));

                    if (match && !sample.includes(match)) sample.push(match);
                }

                assert.ok(
                    sample.length > 0,
                    `no tracked file of ${glob} is ignored by oxlint; cover the case another way`
                );

                // Precondition: without the flag these files really are all ignored, so the case below
                // cannot pass for lack of an ignored file.
                const without = command
                    .split(/\s+/)
                    .filter((word) => word !== UNMATCHED_FLAG)
                    .join(' ');
                const bare = runOxlint(without, sample);

                assert.equal(bare.status, 1, `${sample.join(', ')}: ${bare.output}`);
                assert.match(bare.output, new RegExp(NO_FILES_MESSAGE));

                const configured = runOxlint(command, sample);

                assert.equal(configured.status, 0, `${sample.join(', ')}: ${configured.output}`);
            });
        }
    }
);
