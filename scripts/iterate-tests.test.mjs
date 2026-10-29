// Guards the iterate chain's test leg. The load-bearing property is that a change jest's import walk
// cannot see still reaches the tests: `jest --onlyChanged --passWithNoTests` exits 0 when the walk
// selects nothing, so a broken config passed the iterate chain and failed at the push.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { WIDENING_PATHS, changedPaths, planJest } from './iterate-tests.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'iterate-tests.mjs');
const NARROW = ['--onlyChanged', '--passWithNoTests'];

/* Every case runs in a throwaway git repo, never against this repo's own working tree. Git's own
   environment must not leak in: inside a hook, git exports GIT_DIR to the process tree and a child
   git call inheriting it acts on the REAL repo instead of the temp dir. */
const GIT_ENV = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

const git = (args, cwd) =>
    execFileSync('git', args, {
        cwd,
        env: GIT_ENV,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });

const BASELINE = [...WIDENING_PATHS, 'src/x.ts', 'README.md', 'docs/tsconfig.json'];

const roots = [];

afterEach(() => {
    for (const root of roots.splice(0)) {
        rmSync(root, { recursive: true, force: true });
    }
});

const write = (repo, file, content) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), content);
};

/* A repository with one commit holding every widening path and a few ordinary files. */
const makeRepo = ({ files = BASELINE } = {}) => {
    const repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'iterate-tests-')));
    roots.push(repo);
    git(['init', '-q'], repo);
    git(['config', 'user.email', 'test@example.com'], repo);
    git(['config', 'user.name', 'Test'], repo);
    git(['config', 'commit.gpgsign', 'false'], repo);
    for (const file of files) {
        write(repo, file, 'before');
    }
    git(['add', '-A'], repo);
    git(['commit', '-q', '--no-verify', '-m', 'baseline'], repo);
    return repo;
};

const isWide = (plan) => !plan.args.includes('--onlyChanged');

describe('planJest: a change jest cannot trace widens the run to the whole suite', () => {
    for (const file of WIDENING_PATHS) {
        it(`runs everything when ${file} has an unstaged edit`, () => {
            const repo = makeRepo();
            write(repo, file, 'after');

            const plan = planJest({ cwd: repo });

            assert.equal(isWide(plan), true, `args were ${plan.args.join(' ')}`);
            assert.match(plan.reason, new RegExp(file.replaceAll('.', '\\.')));
        });
    }

    it('runs everything when the edit is staged and the working tree is clean again', () => {
        const repo = makeRepo();
        write(repo, 'babel.config.js', 'after');
        git(['add', 'babel.config.js'], repo);

        assert.equal(isWide(planJest({ cwd: repo })), true);
    });

    it('runs everything when the file is new and untracked', () => {
        const repo = makeRepo({ files: BASELINE.filter((file) => file !== 'metro.config.js') });
        write(repo, 'metro.config.js', 'new');

        assert.equal(isWide(planJest({ cwd: repo })), true);
    });

    it('runs everything when the file was deleted', () => {
        const repo = makeRepo();
        rmSync(path.join(repo, 'tsconfig.json'));

        assert.equal(isWide(planJest({ cwd: repo })), true);
    });

    it('runs everything when the file was renamed away', () => {
        const repo = makeRepo();
        git(['mv', 'src/test/setup.ts', 'src/test/setup-old.ts'], repo);

        assert.equal(isWide(planJest({ cwd: repo })), true);
    });

    it('runs everything when a widening path changes next to ordinary files', () => {
        const repo = makeRepo();
        write(repo, 'src/x.ts', 'after');
        write(repo, 'package.json', 'after');

        assert.equal(isWide(planJest({ cwd: repo })), true);
    });

    it('drops --passWithNoTests on the wide run, so a config that finds no test fails there', () => {
        const repo = makeRepo();
        write(repo, 'package.json', 'after');

        assert.deepEqual(planJest({ cwd: repo }).args, []);
    });

    it('runs everything when git cannot say what changed (no repository)', () => {
        const folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'iterate-tests-')));
        roots.push(folder);

        const plan = planJest({ cwd: folder });

        assert.equal(isWide(plan), true);
        assert.match(plan.reason, /git could not list the changes/);
    });

    it('runs everything when git cannot say what changed (no commit yet)', () => {
        const folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'iterate-tests-')));
        roots.push(folder);
        git(['init', '-q'], folder);

        assert.equal(isWide(planJest({ cwd: folder })), true);
    });
});

describe('planJest: any other change keeps the selection by the import walk', () => {
    it('selects by change when a source file has an edit', () => {
        const repo = makeRepo();
        write(repo, 'src/x.ts', 'after');

        assert.deepEqual(planJest({ cwd: repo }).args, NARROW);
    });

    it('selects by change when only a doc has an edit', () => {
        const repo = makeRepo();
        write(repo, 'README.md', 'after');

        assert.deepEqual(planJest({ cwd: repo }).args, NARROW);
    });

    it('selects by change when the tree is clean', () => {
        const repo = makeRepo();

        assert.deepEqual(planJest({ cwd: repo }).args, NARROW);
    });

    it('selects by change when a file only shares its name with a widening path', () => {
        const repo = makeRepo();
        write(repo, 'docs/tsconfig.json', 'after');
        write(repo, 'src/package.json', 'new');

        assert.deepEqual(planJest({ cwd: repo }).args, NARROW);
    });
});

describe('changedPaths', () => {
    it('lists staged, unstaged, untracked and deleted paths once each, sorted', () => {
        const repo = makeRepo();
        write(repo, 'src/x.ts', 'after');
        git(['add', 'src/x.ts'], repo);
        write(repo, 'src/x.ts', 'after again');
        write(repo, 'README.md', 'after');
        write(repo, 'notes/new.md', 'new');
        rmSync(path.join(repo, 'global.css'));

        assert.deepEqual(changedPaths({ cwd: repo }), [
            'README.md',
            'global.css',
            'notes/new.md',
            'src/x.ts'
        ]);
    });

    it('is empty for a clean tree', () => {
        assert.deepEqual(changedPaths({ cwd: makeRepo() }), []);
    });
});

/* The script runs jest through `npx`; a stand-in `npx` on the PATH records its arguments and stops the
   way the case chooses, so what is measured is the script's own choice of run and its exit status. */
describe('the CLI', () => {
    const runCli = (repo, stopWith) => {
        const shims = realpathSync(mkdtempSync(path.join(tmpdir(), 'iterate-tests-npx-')));
        roots.push(shims);
        const record = path.join(shims, 'args.txt');
        writeFileSync(
            path.join(shims, 'npx'),
            `#!/bin/sh\nprintf '%s\\n' "$@" > "$NPX_RECORD"\n${stopWith}\n`,
            { mode: 0o755 }
        );
        const result = spawnSync(process.execPath, [SCRIPT], {
            cwd: repo,
            env: {
                ...GIT_ENV,
                NPX_RECORD: record,
                PATH: `${shims}${path.delimiter}${process.env.PATH ?? ''}`
            },
            encoding: 'utf8'
        });

        return {
            result,
            args: readFileSync(record, 'utf8')
                .split('\n')
                .filter((line) => line !== '')
        };
    };

    it('asks npx, without installing, for the selected run on a source change', () => {
        const repo = makeRepo();
        write(repo, 'src/x.ts', 'after');

        const { result, args } = runCli(repo, 'exit 0');

        assert.equal(result.status, 0);
        assert.deepEqual(args, ['--no-install', 'jest', ...NARROW]);
        assert.match(result.stdout, /jest runs the tests the changes reach/);
    });

    it('asks for the whole suite on a dirty config, and says which file did it', () => {
        const repo = makeRepo();
        write(repo, 'babel.config.js', 'after');

        const { result, args } = runCli(repo, 'exit 0');

        assert.equal(result.status, 0);
        assert.deepEqual(args, ['--no-install', 'jest']);
        assert.match(result.stdout, /babel\.config\.js changed/);
    });

    it('fails with the status jest failed with', () => {
        const { result } = runCli(makeRepo(), 'exit 3');

        assert.equal(result.status, 3);
    });

    it('fails when jest is killed by a signal, which leaves no status', () => {
        const { result } = runCli(makeRepo(), 'kill -9 $$');

        assert.equal(result.status, 1);
    });

    it('names the signal on one line when jest is killed by it', () => {
        const { result } = runCli(makeRepo(), 'kill -9 $$');

        assert.match(result.stderr, /^iterate-tests: .*SIGKILL/m);
    });

    it('names the cause on one line, and fails, when npx cannot be started', () => {
        // Every PATH entry that holds an npx is dropped, so npx cannot be found and the spawn
        // fails.
        const withoutNpx = (process.env.PATH ?? '')
            .split(path.delimiter)
            .filter((dir) => !existsSync(path.join(dir, 'npx')))
            .join(path.delimiter);

        const result = spawnSync(process.execPath, [SCRIPT], {
            cwd: makeRepo(),
            env: { ...GIT_ENV, PATH: withoutNpx },
            encoding: 'utf8'
        });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /^iterate-tests: .*ENOENT/m);
    });

    it('adds no cause line when jest fails with a status of its own', () => {
        const { result } = runCli(makeRepo(), 'exit 3');

        assert.doesNotMatch(result.stderr, /^iterate-tests:/m);
    });
});

describe('WIDENING_PATHS', () => {
    it('names files this repository has, so a rename cannot disarm the list unseen', () => {
        for (const file of WIDENING_PATHS) {
            assert.equal(existsSync(path.resolve(file)), true, `${file} does not exist`);
        }
    });

    it('names every setup file the jest block loads for each test', () => {
        const { jest } = JSON.parse(readFileSync('package.json', 'utf8'));
        const setupFiles = [...(jest.setupFiles ?? []), ...(jest.setupFilesAfterEnv ?? [])].map(
            (file) => file.replace('<rootDir>/', '')
        );

        assert.ok(setupFiles.length > 0, 'the jest block names no setup file');
        for (const file of setupFiles) {
            assert.ok(
                WIDENING_PATHS.includes(file),
                `${file} is loaded by every test but not listed`
            );
        }
    });
});
