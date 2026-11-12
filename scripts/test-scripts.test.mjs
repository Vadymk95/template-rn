// A push that changes no harness file leaves out the harness tests listed under `selfTests` in
// scripts/gate-tiers.json. The decision is made by `scripts/test-scripts.mjs`, the `test:scripts`
// stage: the pre-push hook sets GATE_PUSH=1, and without that marker (or under CI) the stage runs
// exactly `node --test "scripts/**/*.test.mjs"`, as before.
//
// The repository cases use real temporary git repositories with a real `origin` remote (a bare
// repository in a temp folder), never the repository this file sits in.
//
// Runner: `node:test`, like the other gate specs here. A time limit goes on an `it`, never on a
// `describe`: a `describe` limit caps the whole group and cancels the cases still running.
// Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { FALLBACK_BASE, isCi, makeGit, pickBase } from './check-test-siblings.mjs';
import {
    decideSelfTests,
    describeSelfTests,
    findTestFiles,
    readGateGlobs,
    readPushChange,
    readSelfTests,
    testArguments
} from './test-scripts.mjs';

const ROOT = process.cwd();
const SCRIPT = path.resolve(ROOT, 'scripts/test-scripts.mjs');
const GLOBS = JSON.parse(readFileSync(path.resolve(ROOT, 'scripts/gate-files.json'), 'utf8')).paths;
const LISTED = ['scripts/a.test.mjs', 'scripts/b.test.mjs'];
const QUIET = { CI: '', GITHUB_ACTIONS: '', GATE_SELF_TESTS: '' };
const CAPTURE = ['ignore', 'pipe', 'pipe'];

// Hook-exported GIT_* variables would make a child git answer for another repository, and the
// variable `node --test` sets for its children would make a nested `node --test` print the wrong
// format.
const cleanEnv = (extra = {}) => {
    const env = { ...process.env, ...QUIET };
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
        delete env[key];
    }
    delete env.NODE_TEST_CONTEXT;
    delete env.GATE_PUSH;
    return { ...env, ...extra };
};

const decide = (paths, env = QUIET) =>
    decideSelfTests({ env, listed: LISTED, globs: GLOBS, readChange: () => ({ paths }) });

const mustNotRead = () => {
    throw new Error('the change must not be read');
};

describe('decideSelfTests: which pushes leave the listed tests out', () => {
    it('leaves them out when the push changes only app code', () => {
        assert.deepEqual(
            decide([
                'src/lib/a.ts',
                'src/lib/a.test.ts',
                'src/app/_layout.tsx',
                'app.config.ts',
                'src/test/helpers.ts'
            ]),
            { leaveOut: true, reason: '' }
        );
    });

    it('leaves them out when the push changes nothing', () => {
        assert.equal(decide([]).leaveOut, true);
    });

    for (const [kind, file] of [
        ['a script', 'scripts/test-scripts.mjs'],
        ['a test of the harness', 'scripts/new-thing.test.mjs'],
        ['package.json', 'package.json'],
        ['the lockfile', 'package-lock.json'],
        ['a root config', 'eslint.config.mjs'],
        ['a folder glob', '.husky/pre-push'],
        ['a workflow', '.github/workflows/ci.yml'],
        ['a tsconfig glob', 'tsconfig.json'],
        ['a rule file', '.cursor/rules/workflow.mdc'],
        ['the agent guide', 'AGENTS.md'],
        ['the jest setup', 'src/test/setup.ts'],
        ['a device flow', '.maestro/flows/start.yaml'],
        ['the lint plugin', 'tooling/eslint-plugin-template/index.js']
    ]) {
        it(`runs them when the push changes ${kind}`, () => {
            assert.deepEqual(decide(['src/lib/a.ts', file]), {
                leaveOut: false,
                reason: `harness path changed: ${file}`
            });
        });
    }

    it('names the first harness path and how many more', () => {
        const paths = ['src/a.ts', 'scripts/x.mjs', 'package.json', '.husky/pre-push'];

        assert.equal(decide(paths).reason, 'harness path changed: scripts/x.mjs and 2 more');
        assert.equal(
            decide(['scripts/x.mjs', 'AGENTS.md']).reason,
            'harness path changed: scripts/x.mjs and 1 more'
        );
    });

    it('counts every path under scripts/ as a harness path, whatever the manifest lists', () => {
        assert.deepEqual(
            decideSelfTests({
                env: QUIET,
                listed: LISTED,
                globs: [],
                readChange: () => ({ paths: ['src/a.ts', 'scripts/x.mjs'] })
            }),
            { leaveOut: false, reason: 'harness path changed: scripts/x.mjs' }
        );
    });

    it('runs them when what the push changes cannot be told', () => {
        assert.deepEqual(
            decideSelfTests({
                env: QUIET,
                listed: LISTED,
                globs: GLOBS,
                readChange: () => ({ why: 'no merge base with origin/master or origin/main' })
            }),
            {
                leaveOut: false,
                reason: 'cannot tell what this push changes: no merge base with origin/master or origin/main'
            }
        );
    });

    it('runs them when the manifest of harness paths cannot be read', () => {
        const result = decideSelfTests({
            env: QUIET,
            listed: LISTED,
            globs: undefined,
            readChange: () => ({ paths: ['src/a.ts'] })
        });

        assert.equal(result.leaveOut, false);
        assert.match(result.reason, /scripts\/gate-files\.json/);
    });

    it('runs them when no list names a test to leave out', () => {
        const result = decideSelfTests({
            env: QUIET,
            listed: [],
            globs: GLOBS,
            readChange: () => ({ paths: [] })
        });

        assert.equal(result.leaveOut, false);
        assert.match(result.reason, /gate-tiers\.json/);
    });

    it('runs them under CI, without looking at the change', () => {
        for (const ci of [{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
            assert.deepEqual(
                decideSelfTests({
                    env: { ...QUIET, ...ci },
                    listed: LISTED,
                    globs: GLOBS,
                    readChange: mustNotRead
                }),
                { leaveOut: false, reason: 'CI is set' }
            );
        }
    });

    it('runs them when the operator asks, without looking at the change', () => {
        assert.deepEqual(
            decideSelfTests({
                env: { ...QUIET, GATE_SELF_TESTS: 'all' },
                listed: LISTED,
                globs: GLOBS,
                readChange: mustNotRead
            }),
            { leaveOut: false, reason: 'GATE_SELF_TESTS=all' }
        );
    });

    for (const value of ['1', 'ALL', 'true', ' all']) {
        it(`refuses GATE_SELF_TESTS=${JSON.stringify(value)} before any rule looks at anything`, () => {
            const refuse = (extra = {}) =>
                decideSelfTests({
                    env: { ...QUIET, GATE_SELF_TESTS: value, ...extra },
                    listed: LISTED,
                    globs: GLOBS,
                    readChange: mustNotRead
                });

            assert.throws(() => refuse(), new RegExp(`GATE_SELF_TESTS="${value}"`));
            assert.throws(() => refuse(), /\ball\b/);
            assert.throws(() => refuse({ CI: 'true' }), /GATE_SELF_TESTS/);
            assert.throws(() => refuse({ GITHUB_ACTIONS: 'true' }), /GATE_SELF_TESTS/);
        });
    }

    it('takes an unset and an empty override as no override', () => {
        const { GATE_SELF_TESTS: _unset, ...unset } = QUIET;

        assert.equal(decide(['src/a.ts'], unset).leaveOut, true);
        assert.equal(decide(['src/a.ts'], { ...QUIET, GATE_SELF_TESTS: '' }).leaveOut, true);
    });
});

describe('describeSelfTests: the line every push prints', () => {
    it('says how many were left out, why, that CI runs them and how to run them here', () => {
        const line = describeSelfTests({ leaveOut: true, reason: '' }, 9);

        assert.equal(
            line,
            '── push gate: 9 harness self-tests left out (this push changes no harness file; CI runs them; GATE_SELF_TESTS=all git push runs them here) ──'
        );
    });

    it('says that all run, and the reason', () => {
        const line = describeSelfTests(
            { leaveOut: false, reason: 'harness path changed: scripts/x.mjs and 2 more' },
            9
        );

        assert.equal(
            line,
            '── push gate: all harness self-tests run (harness path changed: scripts/x.mjs and 2 more) ──'
        );
    });
});

describe('readGateGlobs and readSelfTests', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    const withScripts = (files) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'gate-globs-'));
        dirs.push(dir);
        mkdirSync(path.join(dir, 'scripts'));
        for (const [name, text] of Object.entries(files)) {
            if (text !== undefined) writeFileSync(path.join(dir, 'scripts', name), text);
        }
        return dir;
    };

    for (const [kind, text] of [
        ['a missing file', undefined],
        ['text that is not JSON', 'nope'],
        ['a manifest with no paths', '{}'],
        ['paths that are not strings', '{"paths":[1]}']
    ]) {
        it(`gives undefined for ${kind} in the manifest`, () => {
            assert.equal(readGateGlobs(withScripts({ 'gate-files.json': text })), undefined);
        });
    }

    it('reads the manifest paths', () => {
        const dir = withScripts({ 'gate-files.json': '{"paths":["scripts/**","AGENTS.md"]}' });

        assert.deepEqual(readGateGlobs(dir), ['scripts/**', 'AGENTS.md']);
    });

    for (const [kind, text] of [
        ['a missing file', undefined],
        ['text that is not JSON', 'nope'],
        ['no selfTests', '{}'],
        ['files that are not a list', '{"selfTests":{"files":"a"}}'],
        ['names that are not strings', '{"selfTests":{"files":[1]}}']
    ]) {
        it(`reads an empty list from ${kind} in gate-tiers.json`, () => {
            assert.deepEqual(readSelfTests(withScripts({ 'gate-tiers.json': text })), []);
        });
    }

    it('reads the listed files', () => {
        const dir = withScripts({
            'gate-tiers.json': '{"selfTests":{"files":["scripts/a.test.mjs"]}}'
        });

        assert.deepEqual(readSelfTests(dir), ['scripts/a.test.mjs']);
    });
});

describe('the base resolution the decision binds to', () => {
    it('knows CI from the two variables the providers set', () => {
        assert.equal(isCi({ CI: 'true' }), true);
        assert.equal(isCi({ GITHUB_ACTIONS: 'true' }), true);
        assert.equal(isCi({ CI: '', GITHUB_ACTIONS: '' }), false);
        assert.equal(isCi({ CI: 'false' }), false);
        assert.equal(isCi({}), false);
    });

    it('falls back to the named base when no remote branch gives a merge base', () => {
        const answers = {
            'rev-parse --verify --quiet HEAD~1^{commit}': 'abc\n'
        };
        const git = (args) => answers[args.join(' ')] ?? null;

        assert.deepEqual(pickBase({ git, env: QUIET }), { ref: FALLBACK_BASE });
        assert.equal(FALLBACK_BASE, 'HEAD~1');
    });
});

describe('readPushChange (real repositories with a real origin)', () => {
    const dirs = [];
    const git = (cwd, args) =>
        execFileSync('git', args, {
            cwd,
            env: cleanEnv(),
            encoding: 'utf8',
            stdio: CAPTURE
        }).trim();

    const write = (root, file, text = 'x\n') => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    const commit = (root, message) => {
        git(root, ['add', '-A']);
        git(root, ['commit', '--quiet', '-m', message]);
    };

    const tempDir = (prefix) => {
        const dir = mkdtempSync(path.join(tmpdir(), prefix));
        dirs.push(dir);
        return dir;
    };

    const initRepo = (branch = 'master') => {
        const root = tempDir('push-change-');
        git(root, ['init', '--quiet', `--initial-branch=${branch}`]);
        git(root, ['config', 'user.email', 'test@example.test']);
        git(root, ['config', 'user.name', 'Test']);
        git(root, ['config', 'commit.gpgsign', 'false']);
        return root;
    };

    /** Gives the repository a bare `origin` and pushes the current branch to it as `<branch>`. */
    const addOrigin = (root, branch) => {
        const bare = tempDir('push-origin-');
        git(bare, ['init', '--quiet', '--bare']);
        git(root, ['remote', 'add', 'origin', bare]);
        git(root, ['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`]);
        git(root, ['fetch', '--quiet', 'origin']);
        return bare;
    };

    /** A repository whose first commit holds a few files and is also `origin/<remote>`. */
    const makeRepo = (remote = 'master') => {
        const root = initRepo(remote === 'main' ? 'main' : 'master');
        write(root, 'src/lib/a.ts');
        write(root, 'scripts/tool.mjs', 'one\nline\nafter\nline\nmore\nlines\nhere\nthere\n');
        write(root, 'package.json', '{}\n');
        commit(root, 'base');
        if (remote) addOrigin(root, remote);
        return root;
    };

    const change = (root, env = QUIET) => readPushChange({ cwd: root, env: cleanEnv(env) });

    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    it('lists the paths of every commit since the merge base with the remote branch', () => {
        const root = makeRepo();
        write(root, 'src/lib/b.ts');
        commit(root, 'one');
        write(root, 'src/lib/c.ts');
        commit(root, 'two');

        assert.deepEqual(change(root), { paths: ['src/lib/b.ts', 'src/lib/c.ts'] });
    });

    it('lists nothing for a branch that adds nothing', () => {
        assert.deepEqual(change(makeRepo()), { paths: [] });
    });

    it('lists a deleted path', () => {
        const root = makeRepo();
        git(root, ['rm', '--quiet', 'scripts/tool.mjs']);
        commit(root, 'delete');

        assert.deepEqual(change(root), { paths: ['scripts/tool.mjs'] });
    });

    it('lists both sides of a rename, however git is configured to detect renames', () => {
        const root = makeRepo();
        git(root, ['config', 'diff.renames', 'true']);
        git(root, ['mv', 'scripts/tool.mjs', 'src/lib/tool.ts']);
        commit(root, 'rename');

        assert.deepEqual(change(root).paths.toSorted(), ['scripts/tool.mjs', 'src/lib/tool.ts']);
    });

    it('feeds a harness file renamed out of the harness into the decision', () => {
        const root = makeRepo();
        git(root, ['mv', 'scripts/tool.mjs', 'src/lib/tool.ts']);
        commit(root, 'rename');

        assert.equal(
            decideSelfTests({
                env: QUIET,
                listed: LISTED,
                globs: GLOBS,
                readChange: () => change(root)
            }).leaveOut,
            false
        );
    });

    it('leaves the tests out for an app-only change, end to end through the decision', () => {
        const root = makeRepo();
        write(root, 'src/lib/b.ts');
        commit(root, 'one');

        assert.deepEqual(
            decideSelfTests({
                env: QUIET,
                listed: LISTED,
                globs: GLOBS,
                readChange: () => change(root)
            }),
            { leaveOut: true, reason: '' }
        );
    });

    it('takes the base from origin/main when there is no origin/master', () => {
        const root = makeRepo('main');
        write(root, 'src/lib/b.ts');
        commit(root, 'one');

        assert.deepEqual(change(root), { paths: ['src/lib/b.ts'] });
    });

    it('cannot tell when there is no remote branch, even though HEAD has a parent', () => {
        const root = makeRepo(null);
        write(root, 'src/lib/b.ts');
        commit(root, 'one');

        assert.match(change(root).why, /merge base with origin\/master or origin\/main/);
    });

    it('cannot tell when the remote has no master or main, only another branch', () => {
        const root = makeRepo(null);
        addOrigin(root, 'develop');
        write(root, 'src/lib/b.ts');
        commit(root, 'one');

        assert.match(change(root).why, /merge base with origin\/master or origin\/main/);
    });

    it('cannot tell when the remote branch shares no history with HEAD', () => {
        const root = makeRepo(null);
        git(root, ['checkout', '--quiet', '--orphan', 'other']);
        git(root, ['rm', '-rf', '--quiet', '.']);
        write(root, 'unrelated.txt');
        commit(root, 'unrelated root');
        addOrigin(root, 'master');
        git(root, ['checkout', '--quiet', 'master']);
        write(root, 'src/lib/b.ts');
        commit(root, 'one');

        assert.match(change(root).why, /merge base/);
    });

    it('cannot tell when git cannot run in the folder', () => {
        const missing = path.join(tmpdir(), 'push-change-no-such-folder');

        assert.match(change(missing).why, /merge base|git/);
    });

    it('cannot tell when the base is found but git cannot list the changed paths', () => {
        const root = makeRepo();
        write(root, 'src/lib/b.ts');
        commit(root, 'one');
        const real = makeGit(root);
        const stubGit = (args) => (args[0] === 'diff' ? null : real(args));

        assert.deepEqual(readPushChange({ cwd: root, env: cleanEnv(), git: stubGit }), {
            why: 'git could not list the changed paths'
        });
    });

    it('cannot tell when the package sits below the repository root', () => {
        const root = initRepo();
        write(root, 'app/src/a.ts');
        write(root, 'app/scripts/tool.mjs');
        commit(root, 'base');
        addOrigin(root, 'master');
        write(root, 'app/scripts/tool.mjs', 'changed\n');
        commit(root, 'one');

        assert.match(change(path.join(root, 'app')).why, /not at the repository root/);
        assert.deepEqual(change(root).paths, ['app/scripts/tool.mjs']);
    });

    it('does not take a hook-exported GIT_DIR for the repository it was asked about', () => {
        const root = makeRepo();
        const decoy = makeRepo(null);
        write(root, 'src/lib/b.ts');
        commit(root, 'one');
        const previous = process.env.GIT_DIR;
        process.env.GIT_DIR = path.join(decoy, '.git');
        try {
            assert.deepEqual(readPushChange({ cwd: root, env: cleanEnv() }), {
                paths: ['src/lib/b.ts']
            });
        } finally {
            if (previous === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = previous;
        }
    });
});

describe('the set of test files the runner finds', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    // Each file names itself in its one test, so the files `node --test` really ran can be read back.
    const TREE = [
        'scripts/a.test.mjs',
        'scripts/sub/deep/b.test.mjs',
        'scripts/Upper.TEST.mjs',
        'scripts/.hidden/c.test.mjs',
        'scripts/node_modules/pkg/d.test.mjs',
        'scripts/e.test.cjs',
        'scripts/f.test.mjs.bak',
        'scripts/.dot.test.mjs',
        'tests/g.test.mjs',
        'src/h.test.mjs'
    ];

    const makeTree = () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'test-files-'));
        dirs.push(dir);
        for (const file of TREE) {
            mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
            writeFileSync(
                path.join(dir, file),
                `import { it } from 'node:test';\nit('RAN ${file}', () => {});\n`
            );
        }
        return dir;
    };

    it('is exactly what `node --test "scripts/**/*.test.mjs"` runs', { timeout: 60_000 }, () => {
        const dir = makeTree();
        const result = spawnSync(
            process.execPath,
            ['--test', '--test-reporter=tap', 'scripts/**/*.test.mjs'],
            { cwd: dir, env: cleanEnv(), encoding: 'utf8' }
        );
        const ran = result.stdout
            .split('\n')
            .map((line) => /^ok \d+ - RAN (.+)$/.exec(line)?.[1])
            .filter(Boolean)
            .toSorted();

        assert.equal(result.status, 0);
        assert.ok(ran.length >= 3, `node ran too little to prove anything: ${ran.join()}`);
        assert.deepEqual(findTestFiles(dir).toSorted(), ran);
    });

    it('finds every test file this repository has under scripts/', () => {
        const flat = readdirSync(path.join(ROOT, 'scripts'))
            .filter((name) => name.endsWith('.test.mjs'))
            .map((name) => `scripts/${name}`);

        assert.deepEqual(findTestFiles(ROOT).toSorted(), flat.toSorted());
    });
});

describe('testArguments: the files `node --test` is given', () => {
    const FOUND = ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'scripts/c.test.mjs'];

    it('is `--test` and the pattern, exactly as before, when nothing is left out', () => {
        assert.deepEqual(testArguments({ found: FOUND, listed: LISTED, leaveOut: false }), [
            '--test',
            'scripts/**/*.test.mjs'
        ]);
    });

    it('names the found files minus the listed ones when the decision says so', () => {
        assert.deepEqual(testArguments({ found: FOUND, listed: LISTED, leaveOut: true }), [
            '--test',
            'scripts/c.test.mjs'
        ]);
    });

    it('goes back to the whole pattern when nothing would be left to run', () => {
        assert.deepEqual(testArguments({ found: LISTED, listed: LISTED, leaveOut: true }), [
            '--test',
            'scripts/**/*.test.mjs'
        ]);
    });
});

/* The runner boots node, then `node --test`, which boots one node per file: a process-boot budget. */
describe('the test:scripts runner: the line, the files and the exit code', () => {
    const dirs = [];
    const git = (cwd, args) => execFileSync('git', args, { cwd, env: cleanEnv(), stdio: CAPTURE });

    // `kills` ends the process that started this spec, which is the `node --test` the script started.
    const testFile = (name, { fails = false, kills = false } = {}) =>
        `import { it } from 'node:test';\nit('ran ${name}', () => { ${
            fails ? "throw new Error('seeded failure');" : ''
        }${kills ? "process.kill(process.ppid, 'SIGKILL');" : ''} });\n`;

    /**
     * A repository whose scripts/ holds a listed a.test.mjs and b.test.mjs and an unlisted
     * c.test.mjs, with a bare origin that holds its first commit.
     */
    const makeFixture = ({
        selfTests = LISTED,
        remote = true,
        failing = [],
        killing = [],
        below = ''
    } = {}) => {
        const top = mkdtempSync(path.join(tmpdir(), 'test-scripts-'));
        dirs.push(top);
        const dir = path.join(top, below);
        mkdirSync(path.join(dir, 'scripts'), { recursive: true });
        for (const name of ['a', 'b', 'c']) {
            writeFileSync(
                path.join(dir, `scripts/${name}.test.mjs`),
                testFile(name, { fails: failing.includes(name), kills: killing.includes(name) })
            );
        }
        writeFileSync(
            path.join(dir, 'scripts/gate-tiers.json'),
            JSON.stringify({ selfTests: { files: selfTests } })
        );
        copyFileSync(
            path.join(ROOT, 'scripts/gate-files.json'),
            path.join(dir, 'scripts/gate-files.json')
        );
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src/a.ts'), 'a\n');
        git(top, ['init', '--quiet', '--initial-branch=master']);
        git(top, ['config', 'user.email', 'test@example.test']);
        git(top, ['config', 'user.name', 'Test']);
        git(top, ['config', 'commit.gpgsign', 'false']);
        git(top, ['add', '-A']);
        git(top, ['commit', '--quiet', '-m', 'base']);
        if (remote) {
            const bare = path.join(top, '..', `${path.basename(top)}-origin`);
            mkdirSync(bare);
            dirs.push(bare);
            git(bare, ['init', '--quiet', '--bare']);
            git(top, ['remote', 'add', 'origin', bare]);
            git(top, ['push', '--quiet', 'origin', 'HEAD:refs/heads/master']);
            git(top, ['fetch', '--quiet', 'origin']);
        }
        return { top, dir };
    };

    const addCommit = ({ top, dir }, file) => {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), 'changed\n');
        git(top, ['add', '-A']);
        git(top, ['commit', '--quiet', '-m', 'change']);
    };

    const run = ({ dir }, extra = {}) => {
        const result = spawnSync(process.execPath, [SCRIPT], {
            cwd: dir,
            env: cleanEnv(extra),
            encoding: 'utf8'
        });
        return { code: result.status, output: `${result.stdout}${result.stderr}` };
    };

    const PUSH = { GATE_PUSH: '1' };

    afterEach(() => {
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    it(
        'leaves the listed files out of an app-only push and prints that',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            addCommit(fixture, 'src/b.ts');

            const { code, output } = run(fixture, PUSH);

            assert.equal(code, 0);
            assert.match(output, /── push gate: 2 harness self-tests left out \(/);
            assert.match(output, /ran c/);
            assert.doesNotMatch(output, /ran a|ran b/);
        }
    );

    it(
        'runs every file when the push changes a script, and says which',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            addCommit(fixture, 'scripts/new.mjs');

            const { code, output } = run(fixture, PUSH);

            assert.equal(code, 0);
            assert.match(
                output,
                /all harness self-tests run \(harness path changed: scripts\/new\.mjs\)/
            );
            assert.match(output, /ran a[\s\S]*ran b|ran b[\s\S]*ran a/);
            assert.match(output, /ran c/);
        }
    );

    it('runs every file when the push changes a manifest path', { timeout: 60_000 }, () => {
        const fixture = makeFixture();
        addCommit(fixture, '.husky/pre-push');

        const { output } = run(fixture, PUSH);

        assert.match(output, /harness path changed: \.husky\/pre-push/);
        assert.match(output, /ran a/);
    });

    it(
        'runs every file when the manifest lists nothing and the change is under scripts/',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            writeFileSync(path.join(fixture.dir, 'scripts/gate-files.json'), '{"paths":[]}\n');
            git(fixture.top, ['add', '-A']);
            git(fixture.top, ['commit', '--quiet', '-m', 'empty manifest']);
            addCommit(fixture, 'scripts/new.mjs');

            const { output } = run(fixture, PUSH);

            assert.match(output, /harness path changed: scripts\/gate-files\.json and 1 more/);
            assert.match(output, /ran a/);
        }
    );

    it(
        'runs every file, and says so, with no remote branch to compare with',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture({ remote: false });
            addCommit(fixture, 'src/b.ts');

            const { output } = run(fixture, PUSH);

            assert.match(output, /all harness self-tests run \(cannot tell what this push changes/);
            assert.match(output, /ran a/);
        }
    );

    it(
        'runs every file when the package sits below the repository root',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture({ below: 'app' });
            addCommit(fixture, 'app/src/b.ts');

            const { output } = run(fixture, PUSH);

            assert.match(output, /not at the repository root/);
            assert.match(output, /ran a/);
        }
    );

    it('runs every file when the list is empty', { timeout: 60_000 }, () => {
        const fixture = makeFixture({ selfTests: [] });
        addCommit(fixture, 'src/b.ts');

        const { output } = run(fixture, PUSH);

        assert.match(output, /scripts\/gate-tiers\.json lists no test to leave out/);
        assert.match(output, /ran a/);
    });

    it('runs every file for GATE_SELF_TESTS=all', { timeout: 60_000 }, () => {
        const fixture = makeFixture();
        addCommit(fixture, 'src/b.ts');

        const { code, output } = run(fixture, { ...PUSH, GATE_SELF_TESTS: 'all' });

        assert.equal(code, 0);
        assert.match(output, /all harness self-tests run \(GATE_SELF_TESTS=all\)/);
        assert.match(output, /ran a/);
    });

    for (const value of ['1', 'ALL', 'true']) {
        it(
            `refuses GATE_SELF_TESTS=${value}: one message, a failing exit, no test run`,
            { timeout: 60_000 },
            () => {
                const fixture = makeFixture();
                addCommit(fixture, 'src/b.ts');

                const { code, output } = run(fixture, { ...PUSH, GATE_SELF_TESTS: value });

                assert.notEqual(code, 0);
                assert.ok(output.includes(`GATE_SELF_TESTS="${value}"`));
                assert.match(output, /\ball\b/);
                assert.doesNotMatch(output, /harness self-tests|ran [abc]/);
            }
        );
    }

    it(
        'refuses a mistyped GATE_SELF_TESTS under CI too, when the push marker is set',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            addCommit(fixture, 'src/b.ts');

            const { code, output } = run(fixture, { ...PUSH, CI: 'true', GATE_SELF_TESTS: '1' });

            assert.equal(code, 1);
            assert.ok(output.includes('GATE_SELF_TESTS="1"'));
            assert.doesNotMatch(output, /harness self-tests|ran [abc]/);
        }
    );

    it(
        'ends with a failing exit when the node --test it started is killed by a signal',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture({ killing: ['c'] });
            addCommit(fixture, 'src/b.ts');

            for (const extra of [{}, PUSH]) {
                const { code } = run(fixture, extra);

                assert.equal(code, 1);
            }
        }
    );

    it(
        'runs every file under CI, and says so when the push marker is set',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            addCommit(fixture, 'src/b.ts');

            const { code, output } = run(fixture, { ...PUSH, CI: 'true' });

            assert.equal(code, 0);
            assert.match(output, /all harness self-tests run \(CI is set\)/);
            assert.match(output, /ran a/);
        }
    );

    it(
        'is plain `node --test` without the marker: every file, no line',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture();
            addCommit(fixture, 'src/b.ts');

            const { code, output } = run(fixture);

            assert.equal(code, 0);
            assert.match(output, /ran a/);
            assert.match(output, /ran c/);
            assert.doesNotMatch(output, /push gate/);
        }
    );

    it('takes only GATE_PUSH=1 as the marker', { timeout: 60_000 }, () => {
        const fixture = makeFixture();
        addCommit(fixture, 'src/b.ts');

        for (const value of ['', '0', 'true']) {
            const { output } = run(fixture, { GATE_PUSH: value });

            assert.match(output, /ran a/);
            assert.doesNotMatch(output, /push gate/);
        }
    });

    it('does not read GATE_SELF_TESTS without the marker', { timeout: 60_000 }, () => {
        const fixture = makeFixture();
        addCommit(fixture, 'src/b.ts');

        const { code, output } = run(fixture, { GATE_SELF_TESTS: '1' });

        assert.equal(code, 0);
        assert.match(output, /ran a/);
    });

    it(
        'passes a failing unlisted file on as a failing exit, with and without the marker',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture({ failing: ['c'] });
            addCommit(fixture, 'src/b.ts');

            assert.notEqual(run(fixture).code, 0);
            assert.notEqual(run(fixture, PUSH).code, 0);
        }
    );

    it(
        'does not run a failing listed file in an app-only push, and does in a harness push',
        { timeout: 60_000 },
        () => {
            const fixture = makeFixture({ failing: ['a'] });
            addCommit(fixture, 'src/b.ts');

            assert.equal(run(fixture, PUSH).code, 0);
            assert.notEqual(run(fixture, { ...PUSH, GATE_SELF_TESTS: 'all' }).code, 0);
            assert.notEqual(run(fixture).code, 0);
        }
    );
});
