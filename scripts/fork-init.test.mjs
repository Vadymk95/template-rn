import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    appendFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { after, before, describe, it } from 'node:test';

// Run from the repo root, as `npm run test:scripts` does.
const ROOT = process.cwd();
const SCRIPT_PATH = 'scripts/fork-init.mjs';
const TEST_PATH = 'scripts/fork-init.test.mjs';
const OWNER_DECISIONS = [
    'Native identity',
    'Assets and EAS',
    'Licence',
    'Example content',
    'Repository layout',
    'Version holds'
];

/* The script rewrites the repository it runs in, so NO case runs it here: every case works on a
   throwaway copy in the system temp folder, and `run` refuses any other working directory. GIT_* is
   stripped so a child `git` never answers for the real repository when this runs inside a hook. */
const CLEAN_ENV = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    CI: ''
};
const CAPTURE = ['ignore', 'pipe', 'pipe'];
const TEMP_ROOT = realpathSync(tmpdir());
const IDENTITY = [
    '-c',
    'user.name=fork-init-test',
    '-c',
    'user.email=fork-init-test@example.invalid'
];

const NEW_NAME = 'acme-portal';
const NEW_TITLE = 'Acme Portal';
const NEW_HOLDER = 'Acme Ltd';

const git = (cwd, ...args) =>
    execFileSync('git', [...IDENTITY, ...args], {
        cwd,
        encoding: 'utf8',
        env: CLEAN_ENV,
        stdio: CAPTURE
    });

const runNode = (cwd, args) => {
    try {
        const output = execFileSync(process.execPath, args, {
            cwd,
            encoding: 'utf8',
            env: CLEAN_ENV,
            stdio: CAPTURE
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const run = (cwd, args) => {
    if (!realpathSync(cwd).startsWith(`${TEMP_ROOT}${sep}`)) {
        throw new Error(`fork:init must only run on a throwaway copy, not in ${cwd}`);
    }
    return runNode(cwd, [SCRIPT_PATH, ...args]);
};

const docsCheck = (cwd) => runNode(cwd, ['scripts/docs-check.mjs']);

const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
const readJson = (dir, file) => JSON.parse(read(dir, file));
const status = (dir) => git(dir, 'status', '--porcelain', '--untracked-files=all');
const commitAll = (dir, message) => {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', message);
};

/** Every file the working tree holds that git lists (tracked, or new and not ignored). */
const listFiles = (dir) =>
    git(dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter((file) => file !== '' && existsSync(join(dir, file)));

/** What a fork must hold after a successful run: no part of the command, every owner decision. */
const expectCommandGone = (dir) => {
    assert.equal(existsSync(join(dir, SCRIPT_PATH)), false);
    assert.equal(existsSync(join(dir, TEST_PATH)), false);
    assert.equal('fork:init' in readJson(dir, 'package.json').scripts, false);
    const traces = listFiles(dir).filter((file) => {
        const text = readFileSync(join(dir, file), 'utf8');
        return text.includes('fork:init') || text.includes('fork-init');
    });
    assert.deepEqual(traces, []);
    const readme = read(dir, 'README.md');
    for (const decision of OWNER_DECISIONS) {
        assert.ok(readme.includes(`**${decision}**`), decision);
    }
    assert.ok(readme.includes('.template-origin.json'));
};

// The history files keep the template's words on purpose, and so does the origin record. The
// other three name the template as a place or a period, not as the fork's identity: the evidence
// links of the version holds point into the template's own pull requests, the reset checklist
// lists the placeholder values a fork replaces, and the static security review is dated.
const KEPT_FILES = new Set([
    '.cursor/brain/DECISIONS.md',
    'CHANGELOG.md',
    '.template-origin.json',
    'scripts/version-holds.json',
    'docs/template-reset.md',
    '.cursor/brain/SECURITY_REVIEW.md'
]);

/** The shared harness block of the agent guide lists the sibling templates by name, byte for byte. */
const withoutHarnessBlock = (file, text) =>
    file === 'AGENTS.md'
        ? text.replace(/<!-- shared-harness:begin -->[\s\S]*<!-- shared-harness:end -->/, '')
        : text;

let base = null;
let origin = null;
const copies = [];

const makeCopy = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fork-init-'));
    copies.push(dir);
    cpSync(base, dir, { recursive: true });
    return dir;
};

describe('fork-init', () => {
    before(() => {
        base = mkdtempSync(join(tmpdir(), 'fork-init-base-'));
        copies.push(base);
        for (const file of listFiles(ROOT)) {
            mkdirSync(dirname(join(base, file)), { recursive: true });
            cpSync(join(ROOT, file), join(base, file));
        }
        git(base, 'init', '-q', '-b', 'master');
        commitAll(base, 'chore: the template as a fork receives it');

        const pkg = readJson(base, 'package.json');
        origin = {
            name: pkg.name,
            version: pkg.version,
            title: /getAppName = \(\) => \{[\s\S]*?return '([^']+)';/.exec(
                read(base, 'app.config.ts')
            )[1],
            holder: /^Copyright \(c\) \d{4} (.+)$/m.exec(read(base, 'LICENSE'))[1],
            commit: git(base, 'rev-parse', 'HEAD').trim()
        };
    });

    after(() => {
        for (const dir of copies) rmSync(dir, { recursive: true, force: true });
    });

    describe('one full run', () => {
        let dir = null;
        let result = null;
        let changed = null;

        before(() => {
            dir = makeCopy();
            result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE, '--holder', NEW_HOLDER]);
            changed = status(dir)
                .split('\n')
                .filter(Boolean)
                .map((line) => line.slice(3));
        });

        it('exits 0 and leaves docs:check green', () => {
            assert.ok(result.output.includes('docs:check'));
            assert.equal(result.code, 0, result.output);
            const check = docsCheck(dir);
            assert.equal(check.code, 0, check.output);
        });

        it('removes the command from the fork and keeps the owner decisions in the README', () => {
            expectCommandGone(dir);
        });

        it('leaves the template name, title and holder in no file but the kept ones', () => {
            const leaks = [];
            for (const file of listFiles(dir)) {
                if (KEPT_FILES.has(file)) continue;
                const content = withoutHarnessBlock(file, read(dir, file));
                for (const old of [origin.name, origin.title, origin.holder]) {
                    if (content.includes(old)) leaks.push(`${file}: ${old}`);
                }
            }
            assert.deepEqual(leaks, []);
        });

        it('gives the manifest, the lockfile root and the release manifest one name and one version', () => {
            const pkg = readJson(dir, 'package.json');
            const lock = readJson(dir, 'package-lock.json');
            const release = readJson(dir, '.release-please-manifest.json');

            assert.deepEqual(
                [pkg.name, lock.name, lock.packages[''].name],
                [NEW_NAME, NEW_NAME, NEW_NAME]
            );
            assert.deepEqual(
                [pkg.version, lock.version, lock.packages[''].version],
                ['0.1.0', '0.1.0', '0.1.0']
            );
            assert.deepEqual(release, { '.': '0.1.0' });
        });

        it('carries the new name and title into the app config, the README and the guides', () => {
            const config = read(dir, 'app.config.ts');
            assert.ok(config.includes(`slug: '${NEW_NAME}',`));
            assert.ok(config.includes(`return '${NEW_TITLE} (Dev)';`));
            assert.ok(config.includes(`return '${NEW_TITLE} (Preview)';`));
            assert.ok(config.includes(`return '${NEW_TITLE}';`));
            const readme = read(dir, 'README.md');
            assert.equal(readme.split('\n')[0], `# ${NEW_TITLE}`);
            assert.ok(readme.includes(`**\`${NEW_NAME}\`**`));
            assert.equal(read(dir, 'AGENTS.md').split('\n')[0], `# ${NEW_NAME} — agent guide`);
            assert.equal(
                read(dir, '.cursor/brain/PROJECT_CONTEXT.md').split('\n')[0],
                `# ${NEW_NAME} — Project Context`
            );
            assert.ok(read(dir, 'LICENSE').includes(` ${NEW_HOLDER}\n`));
        });

        it('leaves the bundle id and the scheme for a person, and says so', () => {
            const config = read(dir, 'app.config.ts');
            assert.ok(config.includes("'com.example.templatern'"));
            assert.ok(config.includes("scheme: 'templatern',"));
            assert.ok(result.output.includes('getBundleId()'));
            assert.ok(result.output.includes('scheme'));
        });

        it('restarts the changelog and points the release bootstrap at the fork’s own commit', () => {
            assert.equal(read(dir, 'CHANGELOG.md'), '# Changelog\n');
            const before = readJson(base, 'release-please-config.json');
            const after = readJson(dir, 'release-please-config.json');
            assert.equal(after['bootstrap-sha'], origin.commit);
            assert.deepEqual(
                { ...after, 'bootstrap-sha': null },
                { ...before, 'bootstrap-sha': null }
            );
        });

        it('records the template, its version and its commit', () => {
            assert.deepEqual(readJson(dir, '.template-origin.json'), {
                template: origin.name,
                version: origin.version,
                commit: origin.commit
            });
        });

        it('starts the decision history empty, with a pointer at the template’s version', () => {
            const decisions = read(dir, '.cursor/brain/DECISIONS.md');
            assert.doesNotMatch(decisions, /^## /m);
            assert.ok(decisions.includes(`version ${origin.version}`));
            assert.ok(decisions.includes('.template-origin.json'));
            const rows = decisions.split('\n').filter((line) => line.startsWith('|'));
            assert.equal(rows.length, 2);
        });

        it('leaves no section pointer into the removed entries', () => {
            const pointers = [];
            for (const file of listFiles(dir)) {
                if (KEPT_FILES.has(file) || !/\.mdc?$/.test(file)) continue;
                read(dir, file)
                    .split('\n')
                    .forEach((line, index) => {
                        if (/DECISIONS\.md`?(?:\]\([^)]*\))?\s*§/.test(line)) {
                            pointers.push(`${file}:${index + 1}`);
                        }
                    });
            }
            assert.deepEqual(pointers, []);
        });

        it('rewrites a pointer written as a link or with a quoted heading, without a stray bracket', () => {
            const extensions = read(dir, '.cursor/brain/EXTENSIONS.md');
            assert.ok(
                extensions.includes(
                    'the template\'s decision "Icons" (`.template-origin.json`) records why'
                )
            );
            assert.ok(extensions.includes('the template\'s decision "i18n and forms"'));
            assert.doesNotMatch(extensions, /\[the template's decision/);
        });

        it('leaves a space between a rewritten pointer and the words that follow it', () => {
            const glued = [];
            for (const file of listFiles(dir)) {
                if (!/\.mdc?$/.test(file)) continue;
                if (read(dir, file).includes('.template-origin.json`)(')) glued.push(file);
            }
            assert.deepEqual(glued, []);
        });

        it('keeps both CodeQL pieces without --private', () => {
            assert.match(read(dir, '.github/workflows/security.yml'), /^ {4}codeql:$/m);
            assert.ok(read(dir, '.github/ruleset.json').includes('CodeQL'));
        });

        it('touches only the files it names', () => {
            const allowed = new Set([
                '.cursor/brain/DECISIONS.md',
                '.cursor/brain/PROJECT_CONTEXT.md',
                '.release-please-manifest.json',
                '.template-origin.json',
                'AGENTS.md',
                'CHANGELOG.md',
                'LICENSE',
                'README.md',
                'app.config.ts',
                'package-lock.json',
                'package.json',
                'release-please-config.json',
                SCRIPT_PATH,
                TEST_PATH
            ]);
            const rewrittenPointers = [
                '.cursor/brain/EXTENSIONS.md',
                '.cursor/brain/VERIFICATION.md'
            ];
            const outside = changed.filter(
                (file) =>
                    !allowed.has(file) &&
                    !rewrittenPointers.includes(file) &&
                    !file.endsWith('.mdc')
            );
            assert.deepEqual(outside, []);
            assert.deepEqual(
                changed.filter((file) => file.endsWith('.mdc')),
                ['.cursor/rules/test-driven-development.mdc']
            );
        });

        it('prints what is left: the GitHub commands in order, the human choices and the seeds', () => {
            const out = result.output;
            const at = (text) => {
                const index = out.indexOf(text);
                assert.ok(index > -1, `missing in the output: ${text}`);
                return index;
            };
            const permission = at('actions/permissions/workflow');
            const label = at('gate-change');
            const ruleset = at(
                'gh api --method POST repos/OWNER/REPO/rulesets --input .github/ruleset.json'
            );
            assert.ok(ruleset > permission);
            assert.ok(ruleset > label);
            at('rules/branches/');
            at('RELEASE_PLEASE_TOKEN');
            at('getBundleId()');
            at('assets/icon.png');
            at('EAS_PROJECT_ID');
            at('src/shared/lib/i18n/constants.ts');
            at('docs/template-reset.md');
            assert.doesNotMatch(out, /removed? the seeds/i);
        });
    });

    describe('refusals', () => {
        const REFUSALS = [
            [
                'an invalid package name',
                ['--name', 'Bad Name', '--title', NEW_TITLE],
                /package name/i
            ],
            [
                'an upper-case package name',
                ['--name', 'Acme', '--title', NEW_TITLE],
                /package name/i
            ],
            [
                'a leading dot in the name',
                ['--name', '.acme', '--title', NEW_TITLE],
                /package name/i
            ],
            [
                'a name Expo cannot use as a slug',
                ['--name', 'acme.app', '--title', NEW_TITLE],
                /slug/i
            ],
            ['a missing name', ['--title', NEW_TITLE], /--name/],
            ['a missing value', ['--title', NEW_TITLE, '--name'], /--name/],
            ['the template’s own name', null, /differ from the template/i],
            ['an empty title', ['--name', NEW_NAME, '--title', ''], /--title/],
            ['a blank title', ['--name', NEW_NAME, '--title', '   '], /--title/],
            ['a missing title', ['--name', NEW_NAME], /--title/],
            [
                'an empty holder',
                ['--name', NEW_NAME, '--title', NEW_TITLE, '--holder', ''],
                /--holder/
            ],
            [
                'an unknown option',
                ['--name', NEW_NAME, '--title', NEW_TITLE, '--bogus'],
                /unknown option/i
            ]
        ];

        for (const [label, args, message] of REFUSALS) {
            it(`refuses ${label} and changes nothing`, { timeout: 30_000 }, () => {
                const dir = makeCopy();
                const head = git(dir, 'rev-parse', 'HEAD');
                const result = run(dir, args ?? ['--name', origin.name, '--title', NEW_TITLE]);

                assert.equal(result.code, 1);
                assert.match(result.output, message);
                assert.equal(status(dir), '');
                assert.equal(git(dir, 'rev-parse', 'HEAD'), head);
            });
        }

        it('refuses a dirty working tree and changes nothing more', { timeout: 30_000 }, () => {
            const dir = makeCopy();
            for (const dirt of [
                () => cpSync(join(dir, 'LICENSE'), join(dir, 'untracked.txt')),
                () => rmSync(join(dir, 'LICENSE'))
            ]) {
                dirt();
                const dirty = status(dir);
                const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

                assert.equal(result.code, 1);
                assert.match(result.output, /not clean/i);
                assert.equal(status(dir), dirty);
            }
        });

        it(
            'refuses a second run with the script copied back, before and after the first is committed',
            { timeout: 120_000 },
            () => {
                const dir = makeCopy();
                assert.equal(run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]).code, 0);
                cpSync(join(ROOT, SCRIPT_PATH), join(dir, SCRIPT_PATH));

                const dirty = status(dir);
                const again = run(dir, ['--name', 'other-app', '--title', 'Other App']);
                assert.equal(again.code, 1);
                assert.match(again.output, /already ran/i);
                assert.equal(status(dir), dirty);

                commitAll(dir, 'chore: start from the template');
                const committed = run(dir, ['--name', 'other-app', '--title', 'Other App']);
                assert.equal(committed.code, 1);
                assert.match(committed.output, /already ran/i);
                assert.equal(status(dir), '');
            }
        );

        it(
            'refuses a tree that already holds the origin record and changes nothing',
            { timeout: 30_000 },
            () => {
                const dir = makeCopy();
                writeFileSync(join(dir, '.template-origin.json'), '{}\n');
                commitAll(dir, 'chore: an initialised fork');
                const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

                assert.equal(result.code, 1);
                assert.match(result.output, /already ran/i);
                assert.equal(status(dir), '');
                assert.equal(readJson(dir, 'package.json').name, origin.name);
            }
        );

        it(
            'exits 1 on a red docs:check and leaves the command whole, edits written',
            { timeout: 120_000 },
            () => {
                const dir = makeCopy();
                appendFileSync(join(dir, 'README.md'), '\nSee `scripts/no-such-file.mjs`.\n');
                commitAll(dir, 'chore: seed a finding docs:check reports');
                const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

                assert.equal(result.code, 1);
                assert.ok(result.output.includes('docs:check: RED'));
                assert.ok(result.output.includes('no-such-file'));
                for (const kept of [SCRIPT_PATH, TEST_PATH]) {
                    assert.equal(existsSync(join(dir, kept)), true, kept);
                }
                assert.ok('fork:init' in readJson(dir, 'package.json').scripts);
                assert.ok(read(dir, 'README.md').includes('npm run fork:init'));
                assert.equal(readJson(dir, 'package.json').name, NEW_NAME);
            }
        );

        it('refuses to run outside a git repository', { timeout: 30_000 }, () => {
            const dir = makeCopy();
            rmSync(join(dir, '.git'), { recursive: true, force: true });
            const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

            assert.equal(result.code, 1);
            assert.match(result.output, /git repository/i);
            assert.equal(readJson(dir, 'package.json').name, origin.name);
        });
    });

    describe('--dry-run', () => {
        it('lists every planned edit and writes nothing', { timeout: 30_000 }, () => {
            const dir = makeCopy();
            const result = run(dir, [
                '--name',
                NEW_NAME,
                '--title',
                NEW_TITLE,
                '--private',
                '--dry-run'
            ]);

            assert.equal(result.code, 0, result.output);
            assert.equal(status(dir), '');
            assert.match(result.output, /dry run/i);
            for (const planned of [
                'package.json',
                'package-lock.json',
                'app.config.ts',
                '.release-please-manifest.json',
                'release-please-config.json',
                'CHANGELOG.md',
                '.template-origin.json',
                '.cursor/brain/DECISIONS.md',
                '.github/workflows/security.yml',
                '.github/ruleset.json',
                SCRIPT_PATH,
                TEST_PATH,
                'fork:init'
            ]) {
                assert.ok(result.output.includes(planned), planned);
            }
            for (const kept of [SCRIPT_PATH, TEST_PATH]) {
                assert.equal(existsSync(join(dir, kept)), true, kept);
            }
            assert.ok('fork:init' in readJson(dir, 'package.json').scripts);
        });
    });

    describe('--private', () => {
        let dir = null;
        let result = null;

        before(() => {
            dir = makeCopy();
            git(dir, 'remote', 'add', 'origin', 'https://github.com/acme/widget.git');
            result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE, '--private']);
        });

        it('removes the CodeQL job and its required check together, and docs:check stays green', () => {
            assert.equal(result.code, 0, result.output);
            const workflow = read(dir, '.github/workflows/security.yml');
            assert.doesNotMatch(workflow, /^ {4}codeql:/m);
            assert.ok(!workflow.includes('codeql-action'));
            assert.match(workflow, /^ {4}gitleaks:$/m);
            assert.match(workflow, /^ {4}zizmor:$/m);

            const contexts = readJson(dir, '.github/ruleset.json')
                .rules.find((rule) => rule.type === 'required_status_checks')
                .parameters.required_status_checks.map((check) => check.context);
            assert.equal(
                contexts.some((context) => context.startsWith('CodeQL')),
                false
            );
            assert.ok(contexts.includes('Secret scan (gitleaks)'));

            const check = docsCheck(dir);
            assert.equal(check.code, 0, check.output);
        });

        it('removes the command from the fork as well', () => {
            expectCommandGone(dir);
        });

        it('reads the owner and repository from the origin remote for the printed commands', () => {
            assert.ok(result.output.includes('repos/acme/widget/rulesets'));
        });
    });

    // An npm scope is legal in a package name but not in an Expo slug, so the package keeps the
    // scope while the slug in the app config loses it.
    describe('a scoped package name', () => {
        const SCOPED_NAME = '@acme/field-app';
        const SCOPED_SLUG = 'field-app';
        let dir = null;
        let result = null;

        before(() => {
            dir = makeCopy();
            result = run(dir, ['--name', SCOPED_NAME, '--title', NEW_TITLE]);
        });

        it('exits 0 and leaves docs:check green', { timeout: 30_000 }, () => {
            assert.equal(result.code, 0, result.output);
            const check = docsCheck(dir);
            assert.equal(check.code, 0, check.output);
        });

        it('keeps the scope in the manifest and both root entries of the lockfile', () => {
            const lock = readJson(dir, 'package-lock.json');

            assert.deepEqual(
                [readJson(dir, 'package.json').name, lock.name, lock.packages[''].name],
                [SCOPED_NAME, SCOPED_NAME, SCOPED_NAME]
            );
        });

        it('drops the scope from the Expo slug in the app config', () => {
            const config = read(dir, 'app.config.ts');
            const slugLines = config.split('\n').filter((line) => /^\s*slug:/.test(line));

            assert.ok(config.includes(`slug: '${SCOPED_SLUG}',`));
            assert.equal(slugLines.length, 1);
            assert.doesNotMatch(slugLines[0], /[@/]/);
        });
    });

    describe('the script itself', () => {
        it('never calls the network and never runs gh', () => {
            const source = readFileSync(resolve(ROOT, SCRIPT_PATH), 'utf8');

            assert.doesNotMatch(source, /\bfetch\s*\(/);
            assert.doesNotMatch(source, /node:(https?|net|dns|tls)\b/);
            assert.doesNotMatch(source, /execFileSync\(\s*['"]gh['"]/);
            const spawned = [...source.matchAll(/execFileSync\(\s*([^,]+),/g)].map((m) =>
                m[1].trim()
            );
            assert.ok(spawned.length > 0);
            for (const command of spawned) {
                assert.ok(['process.execPath', "'git'"].includes(command), command);
            }
        });
    });
});
