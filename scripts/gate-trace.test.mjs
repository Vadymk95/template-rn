// Guards the run tracer. The load-bearing property is PASSTHROUGH: this wrapper sits inside the
// chain pre-push gates on, so anything it does to observe a run must not change whether that run
// is reported as a pass or a fail.
//
// Runner: `node:test`, not Jest — the gate scripts are executable ESM (`.mjs`) and Jest 29 neither
// discovers that extension nor loads real ESM without --experimental-vm-modules. Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
    buildSpawnPlan,
    classifyChange,
    formatLogLine,
    isDocsPath,
    parseStatusPath
} from './gate-trace.mjs';

const SCRIPT = resolve(process.cwd(), 'scripts/gate-trace.mjs');
const LOG_FILE = '.gate-trace.log';

/* Every case runs in a throwaway git repo, never against this repo's real config. Git's own
   environment must not leak in either: inside a hook, git exports GIT_DIR to the process tree and
   a child git call inheriting it acts on the REAL repo instead of the temp dir. */
const GIT_ENV = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    NODE_ENV: process.env.NODE_ENV ?? 'test'
};

const git = (args, cwd) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });

const makeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-trace-'));
    git(['init', '-q'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    git(['commit', '--allow-empty', '-q', '-m', 'init'], dir);
    return dir;
};

const runWrapper = (cwd, args) => {
    try {
        const output = execFileSync('node', [SCRIPT, ...args], {
            cwd,
            encoding: 'utf8',
            env: GIT_ENV
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const readLogLines = (cwd) => {
    try {
        return readFileSync(join(cwd, LOG_FILE), 'utf8')
            .split('\n')
            .filter((line) => line.length > 0);
    } catch {
        return [];
    }
};

const cleanupDirs = [];

afterEach(() => {
    while (cleanupDirs.length > 0) {
        const dir = cleanupDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('gate-trace passthrough (the one thing that must not be got wrong)', () => {
    it('exits with the wrapped command own failing code', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        assert.equal(runWrapper(repo, ['fail', '--', 'node', '-e', 'process.exit(3)']).code, 3);
    });

    it('exits with the wrapped command own passing code', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        assert.equal(runWrapper(repo, ['pass', '--', 'node', '-e', 'process.exit(0)']).code, 0);
    });

    it('logs a line on FAILURE, not only on success', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        runWrapper(repo, ['fail', '--', 'node', '-e', 'process.exit(3)']);
        const fields = readLogLines(repo)[0].split('\t');
        assert.equal(fields[1], 'fail');
        assert.equal(fields[3], '3');
    });

    it('still exits with the command code when the log path itself cannot be written', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        // A directory where the log file belongs: appendFileSync throws EISDIR. Instrumentation
        // may never fail a build, so the exit code must be untouched by it.
        mkdirSync(join(repo, LOG_FILE));
        assert.equal(runWrapper(repo, ['fail', '--', 'node', '-e', 'process.exit(3)']).code, 3);
    });

    it('rejects a call with no separator instead of silently misparsing the command', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        const verdict = runWrapper(repo, ['fail', 'node', '-e', 'process.exit(3)']);
        assert.equal(verdict.code, 2);
        assert.ok(verdict.output.includes('Usage:'));
    });
});

describe('gate-trace log line shape', () => {
    it('writes exactly 8 tab-separated fields in the documented order', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        runWrapper(repo, ['shape', '--', 'node', '-e', 'process.exit(0)']);
        const fields = readLogLines(repo)[0].split('\t');
        assert.equal(fields.length, 8);
        assert.doesNotThrow(() => new Date(fields[0]).toISOString());
        assert.equal(fields[1], 'shape');
        assert.ok(Number(fields[2]) >= 0);
        assert.equal(fields[3], '0');
        assert.notEqual(fields[4], '');
        assert.notEqual(fields[5], '');
        assert.equal(fields[6], 'main');
        assert.equal(fields[7], 'clean');
    });
});

describe('gate-trace change-class detection (real git status)', () => {
    it('classifies a docs-only change', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        writeFileSync(join(repo, 'README.md'), 'x');
        runWrapper(repo, ['docs', '--', 'node', '-e', 'process.exit(0)']);
        assert.equal(readLogLines(repo)[0].split('\t')[7], 'docs');
    });

    it('classifies a code-only change', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        writeFileSync(join(repo, 'index.ts'), 'x');
        runWrapper(repo, ['code', '--', 'node', '-e', 'process.exit(0)']);
        assert.equal(readLogLines(repo)[0].split('\t')[7], 'code');
    });

    it('classifies a mix as mixed', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        writeFileSync(join(repo, 'README.md'), 'x');
        writeFileSync(join(repo, 'index.ts'), 'x');
        runWrapper(repo, ['mixed', '--', 'node', '-e', 'process.exit(0)']);
        assert.equal(readLogLines(repo)[0].split('\t')[7], 'mixed');
    });
});

describe('gate-trace worktree detection', () => {
    it('tags main vs linked worktree and logs both to the SAME shared file', () => {
        const repo = makeRepo();
        cleanupDirs.push(repo);
        const worktreeDir = mkdtempSync(join(tmpdir(), 'gate-trace-wt-'));
        rmSync(worktreeDir, { recursive: true, force: true }); // git worktree add wants a fresh path
        cleanupDirs.push(worktreeDir);
        git(['worktree', 'add', worktreeDir, '-b', 'other-branch'], repo);

        runWrapper(repo, ['main-run', '--', 'node', '-e', 'process.exit(0)']);
        runWrapper(worktreeDir, ['worktree-run', '--', 'node', '-e', 'process.exit(0)']);

        // The worktree keeps no log of its own: both runs land in the main checkout's file.
        assert.equal(readLogLines(worktreeDir).length, 0);
        const lines = readLogLines(repo);
        assert.equal(lines.length, 2);
        const mainFields = lines[0].split('\t');
        const worktreeFields = lines[1].split('\t');
        // git resolves symlinks in its own output (macOS: /var -> /private/var), so the comparison
        // goes through the same resolution rather than the raw mkdtemp path.
        assert.equal(mainFields[6], 'main');
        assert.equal(mainFields[5], realpathSync(repo));
        assert.equal(worktreeFields[6], 'worktree');
        assert.equal(worktreeFields[5], realpathSync(worktreeDir));
    });
});

describe('buildSpawnPlan (pure) — the caffeinate wrap must not reshape the command', () => {
    it('wraps under caffeinate on macOS when the binary exists', () => {
        assert.deepEqual(
            buildSpawnPlan({
                platform: 'darwin',
                caffeinateAvailable: true,
                command: 'npm',
                commandArgs: ['run', 'verify:iter:inner']
            }),
            { command: 'caffeinate', args: ['-dimsu', 'npm', 'run', 'verify:iter:inner'] }
        );
    });

    it('runs the command as-is when caffeinate is missing', () => {
        assert.deepEqual(
            buildSpawnPlan({
                platform: 'darwin',
                caffeinateAvailable: false,
                command: 'npm',
                commandArgs: ['test']
            }),
            { command: 'npm', args: ['test'] }
        );
    });

    it('runs the command as-is on non-mac platforms (CI runners are linux)', () => {
        assert.deepEqual(
            buildSpawnPlan({
                platform: 'linux',
                caffeinateAvailable: true,
                command: 'npm',
                commandArgs: ['test']
            }),
            { command: 'npm', args: ['test'] }
        );
    });
});

describe('classifyChange / parseStatusPath / isDocsPath (pure)', () => {
    it('treats an empty status as clean', () => {
        assert.equal(classifyChange(''), 'clean');
    });

    it('treats every path under .md or .cursor/ as docs', () => {
        assert.equal(classifyChange(' M README.md\n?? .cursor/brain/MAP.md'), 'docs');
    });

    it('treats no docs paths as code', () => {
        assert.equal(classifyChange(' M src/app.tsx\n?? scripts/new.mjs'), 'code');
    });

    it('resolves a rename to its NEW path', () => {
        assert.equal(classifyChange('R  old-name.ts -> README.md'), 'docs');
    });

    it('strips the status prefix and takes the destination of a rename', () => {
        assert.equal(parseStatusPath(' M src/app.tsx'), 'src/app.tsx');
        assert.equal(parseStatusPath('R  old.ts -> new.ts'), 'new.ts');
    });

    it('accepts a root .md file and any .cursor/ path as docs', () => {
        assert.equal(isDocsPath('README.md'), true);
        assert.equal(isDocsPath('.cursor/brain/MAP.md'), true);
        assert.equal(isDocsPath('src/app.tsx'), false);
    });
});

describe('formatLogLine (pure)', () => {
    it('joins the 8 fields in the documented order, tab-separated', () => {
        const line = formatLogLine({
            timestamp: '2026-08-30T00:00:00.000Z',
            label: 'verify:iter',
            durationMs: 1234,
            exitCode: 0,
            context: {
                branch: 'master',
                toplevel: '/repo',
                worktreeKind: 'main',
                changeClass: 'code'
            }
        });
        assert.deepEqual(line.split('\t'), [
            '2026-08-30T00:00:00.000Z',
            'verify:iter',
            '1234',
            '0',
            'master',
            '/repo',
            'main',
            'code'
        ]);
    });

    it('renders a missing exit code as an empty field rather than the string null', () => {
        const line = formatLogLine({
            timestamp: '2026-08-30T00:00:00.000Z',
            label: 'verify:iter',
            durationMs: 1,
            exitCode: null,
            context: {
                branch: 'master',
                toplevel: '/repo',
                worktreeKind: 'main',
                changeClass: 'clean'
            }
        });
        assert.equal(line.split('\t')[3], '');
    });
});
