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
