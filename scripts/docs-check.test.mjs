// Runner: `node:test`, not Jest — see gate-trace.test.mjs. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
    budgetReport,
    checkCiRunSteps,
    checkCommandTable,
    checkDeadDocs,
    checkMemoryImports,
    checkQuarantine,
    checkPathsAndScripts,
    checkPullRequestReadPermission,
    checkRulesetContexts,
    checkSectionPointers,
    checkSuiteBudgets,
    checkSentinels,
    checkVersions,
    classifyToken,
    compareVersion,
    deriveWorkflowContexts,
    extractRunSteps,
    extractTokens,
    findSwitchedOff,
    isPullRequestTriggered,
    listMarkdownFiles,
    listTestFiles,
    normalizeHeading,
    parseTraceRows,
    pathExists,
    percentile90,
    run,
    scriptFamilies
} from './docs-check.mjs';

const ctx = {
    topDirs: new Set(['src', 'scripts', '.cursor']),
    families: new Set(['verify', 'test'])
};

describe('extractTokens', () => {
    it('returns backticked tokens with line numbers and skips fenced blocks', () => {
        const text = 'a `one` b\n```\n`fenced`\n```\n`two`';
        assert.deepEqual(extractTokens(text), [
            { token: 'one', line: 1 },
            { token: 'two', line: 5 }
        ]);
    });
    it('reads relative markdown link targets and skips URLs and anchors', () => {
        const text =
            'see [map](.cursor/brain/MAP.md#wiring), [site](https://example.test/x), [top](#top)';
        assert.deepEqual(extractTokens(text), [{ token: '.cursor/brain/MAP.md', line: 1 }]);
    });
});

describe('classifyToken', () => {
    it('recognises npm scripts by `npm run` and by a colon form whose family exists', () => {
        assert.deepEqual(classifyToken('npm run verify:iter', ctx), {
            kind: 'script',
            value: 'verify:iter'
        });
        assert.deepEqual(classifyToken('verify:iter', ctx), {
            kind: 'script',
            value: 'verify:iter'
        });
        assert.deepEqual(classifyToken('npm run perf:*', ctx), { kind: 'family', value: 'perf:' });
        assert.equal(classifyToken('hover:text-primary', ctx).kind, 'other');
        assert.equal(classifyToken('npm:rolldown-vite', ctx).kind, 'other');
    });
    it('judges only paths anchored in a tracked top-level directory', () => {
        assert.deepEqual(classifyToken('.cursor/brain/MAP.md:', ctx), {
            kind: 'path',
            value: '.cursor/brain/MAP.md'
        });
        assert.deepEqual(classifyToken('./src/env.ts', ctx), { kind: 'path', value: 'src/env.ts' });
        assert.deepEqual(classifyToken('src/env.ts:12', ctx), {
            kind: 'path',
            value: 'src/env.ts'
        });
        assert.deepEqual(classifyToken('src/env.ts:12-14', ctx), {
            kind: 'path',
            value: 'src/env.ts'
        });
        assert.equal(classifyToken('src/pages/<Page>/', ctx).kind, 'other');
        assert.equal(classifyToken('/dev/ui', ctx).kind, 'other');
        assert.equal(classifyToken('msw/node', ctx).kind, 'other');
        assert.equal(classifyToken('PageName.tsx', ctx).kind, 'other');
        assert.equal(
            classifyToken('dist/bundle.html', { ...ctx, topDirs: new Set(['dist']) }).kind,
            'other'
        );
        assert.equal(classifyToken('*.tsbuildinfo', ctx).kind, 'other');
    });
});

describe('scriptFamilies', () => {
    it('collects the first segment of every script name', () => {
        assert.deepEqual(
            [...scriptFamilies({ 'verify:iter': '', test: '', 'test:one': '' })],
            ['verify', 'test']
        );
    });
});

describe('checkPathsAndScripts', () => {
    it('flags a missing script and a missing anchored path, skips history files', () => {
        const docs = [
            ['README.md', 'run `npm run nope` then open `scripts/missing.mjs` or `PLAN.md`'],
            ['AGENTS.md', '`npm run verify:*` is fine, `npm run gone:*` is not'],
            ['.cursor/brain/DECISIONS.md', 'old `scripts/gone.mjs`']
        ];
        const findings = checkPathsAndScripts({
            docs,
            root: '/nowhere',
            scripts: { 'verify:iter': 'x' },
            topDirs: new Set(['scripts'])
        });
        assert.equal(findings.length, 3);
        assert.ok(findings[0].includes('npm run nope'));
        assert.ok(findings[1].includes('scripts/missing.mjs'));
        assert.ok(findings[2].includes('npm run gone:*'));
    });
});

describe('pathExists', () => {
    it('accepts a module named without its extension, rejects a missing one', () => {
        assert.equal(pathExists(process.cwd(), 'scripts/docs-check'), true);
        assert.equal(pathExists(process.cwd(), 'scripts/docs-check.mjs'), true);
        assert.equal(pathExists(process.cwd(), 'scripts/nope'), false);
    });
});

describe('checkSentinels', () => {
    const sentinels = ['never shortened by what the diff touched'];
    it('accepts the sentinel in the home file, a shim and history, flags it elsewhere', () => {
        const docs = [
            ['AGENTS.md', 'the gate runs ONCE, never shortened by what the diff touched'],
            ['.cursor/commands/feat.md', 'never shortened by what the diff touched'],
            ['.cursor/brain/DECISIONS.md', 'never shortened by what the diff touched'],
            ['.cursor/rules/workflow.mdc', 'The push is never shortened by what the diff touched.']
        ];
        const findings = checkSentinels({ docs, sentinels });
        assert.equal(findings.length, 1);
        assert.ok(findings[0].includes('.cursor/rules/workflow.mdc:1'));
    });
});

describe('versions', () => {
    it('compares the major always and the minor only when the doc states one', () => {
        assert.equal(compareVersion('5', undefined, '5.0.0'), true);
        assert.equal(compareVersion('4', '1', '5.0.0'), false);
        assert.equal(compareVersion('19', '3', '19.3.0'), true);
        assert.equal(compareVersion('19', '2', '19.3.0'), false);
    });
    it('flags a doc version that disagrees with the lockfile and skips history files', () => {
        const docs = [
            ['README.md', 'Tests run on Vitest 4.1 and React 19'],
            ['.cursor/brain/DECISIONS.md', 'we moved off Vitest 4.1']
        ];
        const findings = checkVersions({
            docs,
            versions: { Vitest: 'vitest', React: 'react' },
            installed: { vitest: '5.0.0', react: '19.3.0' }
        });
        assert.deepEqual(findings, ['README.md:1: "Vitest 4.1" but vitest is 5.0.0']);
    });
});

describe('checkCommandTable', () => {
    it('reports scripts missing from both tables and honours the internal patterns', () => {
        const findings = checkCommandTable({
            homeText: 'npm run verify:iter\n`probe`',
            scripts: {
                'verify:iter': '',
                probe: '',
                'verify:inner': '',
                prepare: '',
                'docs:check': '',
                'verify:scaffold': ''
            },
            internalScripts: [':inner$', '^prepare$', '^verify:scaffold']
        });
        assert.deepEqual(findings, [
            'AGENTS.md / README.md: script `docs:check` is documented in neither command table'
        ]);
    });
});

describe('checkDeadDocs', () => {
    it('reports a doc nothing points at; accepts a basename reference, a workflow reference, shims, platform files and attached rules', () => {
        const docs = [
            ['AGENTS.md', 'see MAP.md'],
            ['.cursor/brain/MAP.md', ''],
            ['.cursor/brain/ORPHAN.md', ''],
            ['.cursor/docs/guide.md', ''],
            ['.cursor/commands/feat.md', ''],
            ['.github/pull_request_template.md', ''],
            ['.cursor/rules/attached.mdc', '---\nglobs: ["**/*.ts"]\nalwaysApply: false\n---'],
            ['.cursor/rules/orphan.mdc', '---\nglobs: []\nalwaysApply: false\n---']
        ];
        const findings = checkDeadDocs({ docs, extraText: 'cat .cursor/docs/guide.md' });
        assert.deepEqual(findings, [
            '.cursor/brain/ORPHAN.md: no other doc, script or workflow points at it (dead, or a pointer is missing)',
            '.cursor/rules/orphan.mdc: no other doc, script or workflow points at it (dead, or a pointer is missing)'
        ]);
    });
});

describe('normalizeHeading', () => {
    it('drops markdown, emphasis, one trailing parenthetical and end punctuation', () => {
        assert.equal(normalizeHeading('**The `tier` law**:'), 'the tier law');
        assert.equal(normalizeHeading('_Two tools, one file_.'), 'two tools, one file');
        assert.equal(normalizeHeading('Version holds (do not "fix" by bumping)'), 'version holds');
        assert.equal(normalizeHeading('[link text](./x.md) — note'), 'link text - note');
    });

    it('strips an inline HTML tag and keeps the words around it', () => {
        assert.equal(normalizeHeading('The <code>tier</code> law'), 'the tier law');
        assert.equal(normalizeHeading('<b>Bold</b> heading:'), 'bold heading');
    });

    it('strips a tag that removing an inner tag completes', () => {
        assert.equal(normalizeHeading('A <<b>b> B'), 'a b');
        assert.equal(normalizeHeading('<scr<script>ipt>x'), 'x');
    });

    it('leaves no angle bracket behind for nested or unclosed tags', () => {
        for (const raw of [
            'A <<b>b> B',
            '<<script>script>x',
            '<scr<script>ipt>x',
            'A <b B',
            'x <!-- y'
        ]) {
            assert.doesNotMatch(normalizeHeading(raw), /[<>]/);
        }
    });
});

describe('checkSectionPointers', () => {
    const agents = [
        '# Guide',
        '',
        '## Commands / the gate',
        '',
        'The table.',
        '',
        '### The tier law - this section is the ONLY place it lives',
        '',
        '**Content variance**: authored copy is proven against content it has not seen.',
        '',
        '## Version holds (do not "fix" by bumping)',
        '',
        '## Playwright `maxFailures: 10` on the gate run',
        '',
        '## 🔒 Security contract',
        '',
        '## [2026-07] Pre-commit is repo-scoped',
        '',
        '## 4.1a Iteration tier',
        ''
    ].join('\n');
    const pointers = (...lines) =>
        checkSectionPointers({
            docs: [
                ['AGENTS.md', agents],
                ['README.md', lines.join('\n')]
            ]
        });

    it('is red on a pointer whose heading is gone and names file, line, pointer and target', () => {
        assert.deepEqual(pointers('intro', 'See `AGENTS.md` § Removed section.'), [
            'README.md:2: "AGENTS.md § Removed section" — no heading in AGENTS.md matches'
        ]);
    });

    it('is green on a heading that exists, whatever the case, emphasis or trailing punctuation', () => {
        assert.deepEqual(pointers('`AGENTS.md` § Commands / the gate'), []);
        assert.deepEqual(pointers('`AGENTS.md` § COMMANDS / THE GATE.'), []);
        assert.deepEqual(pointers('`AGENTS.md` § **Version holds**'), []);
        assert.deepEqual(pointers('[the guide](AGENTS.md) § Version holds, then the rest'), []);
        assert.deepEqual(pointers('AGENTS.md § Version holds is the list'), []);
    });

    it('is green on headings that carry backticks, punctuation, emoji, a date prefix or a parenthetical', () => {
        assert.deepEqual(
            pointers('`AGENTS.md` § Playwright `maxFailures: 10` on the gate run'),
            []
        );
        assert.deepEqual(pointers('`AGENTS.md` § Playwright `maxFailures: 10`'), []);
        assert.deepEqual(pointers('`AGENTS.md` § Security contract'), []);
        assert.deepEqual(pointers('`AGENTS.md` § Pre-commit is repo-scoped'), []);
        assert.deepEqual(pointers('`AGENTS.md` § Version holds (do not "fix" by bumping)'), []);
        assert.deepEqual(pointers('`AGENTS.md` § do not "fix" by bumping'), []);
    });

    it('answers to the parts of a heading: the number alone, the title, each side of a slash or a dash', () => {
        assert.deepEqual(pointers('`AGENTS.md` § 4.1a'), []);
        assert.deepEqual(pointers('`AGENTS.md` § Iteration tier'), []);
        assert.deepEqual(pointers('`AGENTS.md` § the gate'), []);
        assert.deepEqual(pointers('`AGENTS.md` § The tier law'), []);
        assert.equal(pointers('`AGENTS.md` § 4.1').length, 1);
    });

    it('resolves a `A › B` chain only when B sits under A', () => {
        assert.deepEqual(pointers('`AGENTS.md` § Commands / the gate › _The tier law_'), []);
        assert.deepEqual(pointers('`AGENTS.md` § Commands / the gate › Content variance'), []);
        assert.equal(pointers('`AGENTS.md` § Version holds › The tier law').length, 1);
        assert.equal(pointers('`AGENTS.md` § Nope › The tier law').length, 1);
    });

    it('checks every `§` of an "and §" chain against the one path', () => {
        const docs = [
            ['api.mdc', '## 2. Errors\n\n## 4. Retries\n'],
            ['README.md', 'Read `api.mdc` § 2 and § 4, or § 9.']
        ];
        assert.deepEqual(checkSectionPointers({ docs }), [
            'README.md:1: "api.mdc § 9" — no heading in api.mdc matches'
        ]);
    });

    it('joins a path at the end of one line with the `§` that opens the next', () => {
        assert.deepEqual(pointers('read `AGENTS.md`', '§ Version holds'), []);
        assert.equal(pointers('read `AGENTS.md`', '§ Removed section').length, 1);
        assert.deepEqual(pointers('read `AGENTS.md` §', 'Version holds'), []);
    });

    it('resolves a bare file name by basename, with or without the extension', () => {
        const docs = [
            ['.cursor/brain/MAP.md', '## Layout\n'],
            ['AGENTS.md', 'MAP.md § Layout, `MAP` § Layout, and MAP.md § Gone.']
        ];
        assert.deepEqual(checkSectionPointers({ docs }), [
            'AGENTS.md:1: "MAP.md § Gone" — no heading in .cursor/brain/MAP.md matches'
        ]);
    });

    it('does not judge a bare `§`, a non-markdown target, a placeholder or anything inside a fence', () => {
        const docs = [
            ['AGENTS.md', '## Real\n'],
            [
                'README.md',
                [
                    'Within this file, see § 4.1a.',
                    '`scripts/gate-tiers.json` § `suites` holds the budget.',
                    '`<file>` § <Heading> is the form.',
                    '```',
                    '`AGENTS.md` § Gone',
                    '```'
                ].join('\n')
            ]
        ];
        assert.deepEqual(checkSectionPointers({ docs }), []);
    });

    it('reports a pointer to a markdown file that is not tracked, when it is a bare name or sits in DECISIONS.md', () => {
        const docs = [
            ['AGENTS.md', 'See `GONE.md` § Anything. Or `docs/gone.md` § Anything.'],
            ['.cursor/brain/DECISIONS.md', 'Evidence: `docs/gone.md` § Anything.']
        ];
        assert.deepEqual(checkSectionPointers({ docs }), [
            'AGENTS.md:1: "GONE.md § Anything" — GONE.md is not a tracked markdown file',
            '.cursor/brain/DECISIONS.md:1: "docs/gone.md § Anything" — docs/gone.md is not a tracked markdown file'
        ]);
    });

    it('checks DECISIONS.md like every other file', () => {
        const docs = [
            ['AGENTS.md', '## Lanes\n'],
            [
                '.cursor/brain/DECISIONS.md',
                '## Entry\n\nSee `AGENTS.md` § Lanes and `AGENTS.md` § Maintaining.'
            ]
        ];
        assert.deepEqual(checkSectionPointers({ docs }), [
            '.cursor/brain/DECISIONS.md:3: "AGENTS.md § Maintaining" — no heading in AGENTS.md matches'
        ]);
    });

    it('ignores a heading-looking line inside a fence when it resolves a pointer', () => {
        const docs = [
            ['AGENTS.md', '## Real\n\n```md\n## Only in a fence\n```\n'],
            ['README.md', '`AGENTS.md` § Only in a fence']
        ];
        assert.equal(checkSectionPointers({ docs }).length, 1);
    });
});

describe('listMarkdownFiles', () => {
    it('falls back to the known doc locations when the root is not a git checkout', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docs-check-list-'));
        try {
            mkdirSync(path.join(root, '.cursor/brain'), { recursive: true });
            writeFileSync(path.join(root, 'AGENTS.md'), '# A\n');
            writeFileSync(path.join(root, '.cursor/brain/MAP.md'), '# M\n');
            assert.deepEqual(listMarkdownFiles(root).sort(), ['.cursor/brain/MAP.md', 'AGENTS.md']);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('run: section pointers', () => {
    const withRepo = (agents, check) => {
        const root = mkdtempSync(path.join(tmpdir(), 'docs-check-run-'));
        try {
            mkdirSync(path.join(root, 'scripts'));
            writeFileSync(path.join(root, 'scripts/gate-tiers.json'), '{}');
            writeFileSync(path.join(root, 'package.json'), '{"scripts":{}}');
            writeFileSync(path.join(root, 'package-lock.json'), '{"packages":{}}');
            writeFileSync(path.join(root, 'AGENTS.md'), agents);
            writeFileSync(path.join(root, 'README.md'), '# Readme\n\n## Setup\n');
            check(run({ root, weekly: true, today: '2026-10-09' }).findings);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    };

    it('fails the check on a dangling section pointer', () => {
        withRepo('See `README.md` § Gone.\n', (findings) => {
            assert.deepEqual(findings, [
                'AGENTS.md:1: "README.md § Gone" — no heading in README.md matches'
            ]);
        });
    });

    it('passes when every section pointer resolves', () => {
        withRepo('See `README.md` § Setup.\n', (findings) => {
            assert.deepEqual(findings, []);
        });
    });
});

describe('budget', () => {
    it('computes a nearest-rank p90', () => {
        assert.equal(percentile90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9);
        assert.equal(percentile90([]), null);
    });
    it('parses 8- and 9-column rows and ignores malformed ones', () => {
        const rows = parseTraceRows(
            't\tverify:push\t1000\t0\tmaster\t/r\tmain\tcode\nt\tverify:push\t2000\t0\tmaster\t/r\tmain\tcode\t0\nbroken\n'
        );
        assert.equal(rows.length, 2);
        assert.equal(rows[0].phase, '');
        assert.equal(rows[1].phase, '0');
    });
    const row = (durationMs, phase = '0', exitCode = '0') => ({
        label: 'verify:ci',
        durationMs,
        exitCode,
        phase
    });
    const many = (count, ms) => Array.from({ length: count }, () => row(ms));

    it('calibrates to this machine instead of judging it by a number from another', () => {
        const first = budgetReport({
            rows: many(10, 24000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8
        });

        assert.equal(first.kind, 'ok');
        assert.equal(first.baselineMs, 24000);
        assert.ok(first.message.includes('calibrated to THIS machine'));
    });

    /* The whole point of the rewrite, and it matters most in a template: the same gate on slower
       hardware must not read red. Two machines, one three times the other, both fine. */
    it('reports the same verdict on fast and slow hardware', () => {
        const fast = budgetReport({
            rows: many(10, 20000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8
        });
        const slow = budgetReport({
            rows: many(10, 60000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8
        });

        assert.equal(fast.kind, 'ok');
        assert.equal(slow.kind, 'ok');
        assert.equal(
            budgetReport({
                rows: many(10, 60000),
                label: 'verify:ci',
                phase: '0',
                minRuns: 8,
                baselineMs: slow.baselineMs
            }).kind,
            'ok'
        );
    });

    it('waits for enough runs of its own before it judges anything', () => {
        const report = budgetReport({
            rows: many(7, 24000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8
        });

        assert.equal(report.kind, 'skip');
        assert.ok(report.message.includes('CALIBRATING'));
    });

    it('finds drift past the ratio and names both numbers, without moving the baseline up', () => {
        const report = budgetReport({
            rows: many(10, 40000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8,
            driftRatio: 1.3,
            baselineMs: 24000
        });

        assert.equal(report.kind, 'warn');
        assert.ok(report.message.includes('1.67x'));
        assert.equal(report.baselineMs, 24000);
    });

    /* Down-only ratchet: a gate that genuinely got faster lowers the bar it is held to next time,
       with no edit and no decision. */
    it('lowers the baseline by itself when the gate gets faster', () => {
        const report = budgetReport({
            rows: many(10, 15000),
            label: 'verify:ci',
            phase: '0',
            minRuns: 8,
            baselineMs: 24000
        });

        assert.equal(report.baselineMs, 15000);
        assert.ok(report.message.includes('is faster'));
    });

    it('keeps the phases apart, because a phase-0 push is a different measurement', () => {
        const rows = [...many(10, 20000), ...many(10, 90000).map((r) => ({ ...r, phase: 'full' }))];

        assert.equal(
            budgetReport({ rows, label: 'verify:ci', phase: '0', minRuns: 8 }).baselineMs,
            20000
        );
        assert.equal(
            budgetReport({ rows, label: 'verify:ci', phase: 'full', minRuns: 8 }).baselineMs,
            90000
        );
    });

    it('takes p90 over the last N runs when a window is set, and names the window', () => {
        const rows = [...many(10, 60000), ...many(20, 24000)];

        assert.equal(
            budgetReport({ rows, label: 'verify:ci', phase: '0', minRuns: 8 }).baselineMs,
            60000
        );

        const windowed = budgetReport({
            rows,
            label: 'verify:ci',
            phase: '0',
            minRuns: 8,
            budgetWindow: 20
        });
        assert.equal(windowed.baselineMs, 24000);
        assert.ok(windowed.message.includes('the last 20 of 30 runs'));
    });
});

describe('run: dates in prose', () => {
    it('reads no deadline out of a revisit line, however far past the date is', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docs-check-run-'));
        try {
            mkdirSync(path.join(root, 'scripts'));
            writeFileSync(path.join(root, 'scripts/gate-tiers.json'), '{}');
            writeFileSync(path.join(root, 'package.json'), '{"scripts":{}}');
            writeFileSync(path.join(root, 'package-lock.json'), '{"packages":{}}');
            writeFileSync(
                path.join(root, 'AGENTS.md'),
                'Revisit trigger 2020-01-01\nre-check on 2020-02-02\ncheckpoint 2020-03-03\n'
            );
            const { findings } = run({ root, weekly: true, today: '2026-10-09' });
            assert.deepEqual(findings, []);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('checkQuarantine', () => {
    const today = '2026-09-13';
    it('flags a focused test, an unconditional skip without a marker and an expired quarantine', () => {
        const tests = [
            /* Assembled so this file's own source never matches the patterns it tests. */
            ['a.test.ts', `${'it'}.only('x', () => {});`],
            ['b.spec.ts', `${'test'}.skip('flaky', async () => {});`],
            [
                'c.test.ts',
                `// quarantine until 2026-09-01: waits on the upstream fix\n${'describe'}.skip('x', () => {});`
            ]
        ];
        const findings = checkQuarantine({ tests, today });
        assert.equal(findings.length, 3);
        assert.ok(findings[0].includes('a.test.ts:1'));
        assert.ok(findings[1].includes('quarantine until YYYY-MM-DD'));
        assert.ok(findings[2].includes('has expired'));
    });
    it('accepts a conditional skip on the same or the next line, and a live quarantine', () => {
        const tests = [
            [
                'd.spec.ts',
                `${'test'}.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');`
            ],
            [
                'e.spec.ts',
                `${'test'}.skip(\n    ({ baseURL }) => !baseURL?.includes(':4173'),\n    'preview only'\n);`
            ],
            [
                'f.test.ts',
                `// quarantine until 2026-10-01: the fixture is rewritten in the next slice\n${'it'}.skip('x', () => {});`
            ]
        ];
        assert.deepEqual(checkQuarantine({ tests, today }), []);
    });

    /* The date is the first red day, and the furthest it may sit is 30 days after today. Every
       fixture is assembled, so this file's own source never matches the patterns it tests. */
    describe('the date boundaries', () => {
        const quarantinedUntil = (date) => [
            [
                'g.test.ts',
                `// quarantine until ${date}: waits on the upstream fix\n${'it'}.skip('x', () => {});`
            ]
        ];

        it('passes the day before the date', () => {
            assert.deepEqual(checkQuarantine({ tests: quarantinedUntil('2026-09-14'), today }), []);
        });

        it('is red ON the date, and says so', () => {
            const findings = checkQuarantine({ tests: quarantinedUntil(today), today });
            assert.equal(findings.length, 1);
            assert.ok(findings[0].includes('has expired'));
            assert.ok(findings[0].includes('red ON the date'));
        });

        it('is red the day after the date', () => {
            const findings = checkQuarantine({ tests: quarantinedUntil('2026-09-12'), today });
            assert.equal(findings.length, 1);
            assert.ok(findings[0].includes('has expired'));
        });

        it('accepts a date exactly 30 days out', () => {
            assert.deepEqual(checkQuarantine({ tests: quarantinedUntil('2026-10-13'), today }), []);
        });

        it('is red 31 days out, and the message names the 30-day cap and the latest date', () => {
            const findings = checkQuarantine({ tests: quarantinedUntil('2026-10-14'), today });
            assert.equal(findings.length, 1);
            assert.ok(findings[0].includes('more than 30 days away'));
            assert.ok(findings[0].includes('2026-10-13 at the latest'));
        });

        it('is red for a date parked far out of sight', () => {
            const findings = checkQuarantine({ tests: quarantinedUntil('2099-12-31'), today });
            assert.equal(findings.length, 1);
            assert.ok(findings[0].includes('more than 30 days away'));
        });

        it('counts the 30 days across a month and a year end', () => {
            const tests = quarantinedUntil('2027-01-10');
            assert.deepEqual(checkQuarantine({ tests, today: '2026-12-11' }), []);
            assert.equal(checkQuarantine({ tests, today: '2026-12-10' }).length, 1);
        });
    });

    /* A skip is wider than `.skip(`: each form below switches a test off, or inverts it so that a
       failing body passes, just as well. Every fixture is assembled from parts, so this file's own
       source never matches the patterns it tests. */
    describe('every way to switch a test off', () => {
        const form = (...parts) => parts.join('');
        const UNCONDITIONAL = [
            ['skipIf with a constant true', form('it', '.skip', "If(true)('x', () => {});")],
            ['skipIf with a constant 1', form('it', '.skip', "If(1)('x', () => {});")],
            ['runIf with a constant false', form('it', '.run', "If(false)('x', () => {});")],
            ['describe skipIf with true', form('describe', '.skip', "If(true)('x', () => {});")],
            ['describe runIf with false', form('describe', '.run', "If(false)('x', () => {});")],
            ['a test skipIf with true', form('test', '.skip', "If(true)('x', () => {});")],
            ['it skip each', form('it', '.skip', ".each([1, 2])('x %i', () => {});")],
            ['test skip each', form('test', '.skip', ".each([1, 2])('x %i', () => {});")],
            ['describe skip each', form('describe', '.skip', ".each([1])('x', () => {});")],
            ['it fails', form('it', '.fails', "('x', () => {});")],
            ['test fails', form('test', '.fails', "('x', () => {});")],
            ['a concurrent skip', form('test', '.concurrent', '.skip', "('x', () => {});")],
            ['a Jest xit', form('x', 'it', "('x', () => {});")],
            ['a Jest xtest', form('x', 'test', "('x', () => {});")],
            ['a Jest xdescribe', form('x', 'describe', "('x', () => {});")],
            ['runIf with a constant 0', form('it', '.run', "If(0)('x', () => {});")],
            ['runIf with null', form('it', '.run', "If(null)('x', () => {});")],
            ['skipIf with spaces around true', form('it', '.skip', "If( true )('x', () => {});")],

            /* Jest: an expected failure is a switched-off test, and so is an x-prefixed table. */
            ['a Jest it failing', form('it', '.fail', "ing('x', () => {});")],
            ['a Jest test failing', form('test', '.fail', "ing('x', () => {});")],
            ['a Jest failing table', form('it', '.fail', "ing.each([1])('x %i', () => {});")],
            [
                'a Jest test failing table',
                form('test', '.fail', "ing.each([1])('x %i', () => {});")
            ],
            [
                'a Jest concurrent failing',
                form('it', '.concurrent', '.fail', "ing('x', () => {});")
            ],
            ['a Jest xit table', form('x', 'it', ".each([1])('x %i', () => {});")],
            ['a Jest xtest table', form('x', 'test', ".each([1])('x %i', () => {});")],
            ['a Jest xdescribe table', form('x', 'describe', ".each([1])('x', () => {});")],
            ['a Jest xit failing', form('x', 'it', ".failing('x', () => {});")],
            ['a Jest xtest failing', form('x', 'test', ".failing('x', () => {});")],
            [
                'a skipped Jest table written as a template',
                form('it', '.skip', ".each`a|b`('x', f);")
            ],
            ['it skip concurrent', form('it', '.skip', ".concurrent('x', () => {});")],
            ['it skip for', form('it', '.skip', ".for([1])('x %i', () => {});")],
            ['it fails table', form('it', '.fails', ".each([1])('x %i', () => {});")],

            /* Playwright: a declaration with a title, a bare call, a constant true, a skipped step. */
            ['a Playwright test fail declaration', form('test', '.fail', "('x', async () => {});")],
            [
                'a Playwright test fixme declaration',
                form('test', '.fix', "me('x', async () => {});")
            ],
            ['a Playwright describe fixme', form('test.describe', '.fix', "me('x', () => {});")],
            ['a Playwright describe skip', form('test.describe', '.sk', "ip('x', () => {});")],
            [
                'a Playwright fail with details',
                form('test', '.fail', "('x', { tag: '@a' }, async () => {});")
            ],
            [
                'a Playwright skip with details',
                form('test', '.sk', "ip('x', { tag: '@a' }, async () => {});")
            ],
            ['a Playwright skip with a constant true', form('test', '.sk', "ip(true, 'why');")],
            ['a Playwright fixme with a constant true', form('test', '.fix', "me(true, 'why');")],
            ['a Playwright fail with a constant true', form('test', '.fail', "(true, 'why');")],
            ['a Playwright skip with a constant 1', form('test', '.sk', 'ip(1);')],
            ['a bare Playwright skip', form('test', '.sk', 'ip();')],
            ['a bare Playwright fixme', form('test', '.fix', 'me();')],
            ['a bare Playwright fail', form('test', '.fail', '();')],
            ['a testInfo skip', form('testInfo', '.sk', 'ip();')],
            ['a testInfo fixme', form('testInfo', '.fix', 'me();')],
            ['a testInfo fail', form('testInfo', '.fail', '();')],
            ['a test.info() fail', form('test', '.info()', '.fail', '();')],
            ['a skipped step', form('await test', '.step', '.sk', "ip('x', async () => {});")],
            ['a skip whose title is a variable', form('it', '.sk', 'ip(name, () => {});')],
            [
                'a skip whose body is a function expression',
                form('it', '.sk', 'ip(name, function () {});')
            ],
            [
                'a skip whose body is an arrow with a bare parameter',
                form('it', '.sk', 'ip(name, done => {});')
            ],
            ['a space before the parenthesis', form('it', '.sk', "ip ('x', f);")],
            [
                'a skip whose title and body are references',
                form('it', '.sk', 'ip(item.name, testBody);')
            ],
            [
                'a skip whose note is a variable, read as a title and a body',
                form('test', '.sk', 'ip(isCi, description);')
            ],
            [
                'a skip whose title is a variable, with details ahead of the body',
                form('test', '.sk', 'ip(title, { tag: tags }, body);')
            ],
            [
                'a skip whose title is a variable and body an async function',
                form('test', '.sk', 'ip(title, async ({ page }) => {});')
            ],
            [
                'a Playwright fail whose title is a variable',
                form('test', '.fail', '(title, async () => {});')
            ],

            /* vitest and node:test: a todo, a bare skip on the test context, expectFailure. */
            ['a todo whose title and body are variables', form('it', '.to', 'do(title, body);')],
            ['a fails whose title and body are variables', form('it', '.fails', '(title, body);')],
            ['a fails with a lone variable', form('it', '.fails', '(spec);')],
            ['a Jest failing with a lone variable', form('it', '.fail', 'ing(spec);')],
            ['an expectFailure with a lone variable', form('test', '.expect', 'Failure(spec);')],
            [
                'a Jest failing whose title and body are variables',
                form('it', '.fail', 'ing(title, body);')
            ],
            [
                'an expectFailure whose title and body are variables',
                form('test', '.expect', 'Failure(title, body);')
            ],
            ['an it todo with a body', form('it', '.to', "do('x', () => {});")],
            ['a test todo', form('test', '.to', "do('x', () => {});")],
            ['a describe todo with a body', form('describe', '.to', "do('x', () => {});")],
            ['a context skip', form('ctx', '.sk', 'ip();')],
            ['a context skip with a note', form('context', '.sk', "ip('no lsof');")],
            ['a t skip', form('t', '.sk', 'ip();')],
            ['a t skip with a message', form('t', '.sk', "ip('why');")],
            ['a t todo', form('t', '.to', 'do();')],
            ['a t todo with a message', form('t', '.to', "do('later');")],
            ['a test expectFailure', form('test', '.expect', "Failure('x', () => {});")],
            ['an it expectFailure', form('it', '.expect', "Failure('x', () => {});")],
            ['a describe expectFailure', form('describe', '.expect', "Failure('x', () => {});")],

            /* The options object: skip, todo, fails and expectFailure set to anything but a falsy constant. */
            ['a skip option set to true', form('it', "('x', { sk", 'ip: true }, () => {});')],
            [
                'a skip option set to an object',
                form('it', "('x', { sk", "ip: { reason: 'x' } }, () => {});")
            ],
            [
                'a skip option set to a regular expression',
                form('it', "('x', { sk", 'ip: /win/ }, () => {});')
            ],
            [
                'a skip option on a for table',
                form('it', ".for([1])('x %i', { sk", 'ip: true }, () => {});')
            ],
            ['a skip option set to 1', form('it', "('x', { sk", 'ip: 1 }, () => {});')],
            ['a skip option with a reason', form('it', "('x', { sk", "ip: 'flaky' }, () => {});")],
            [
                'a skip option with a double-quoted reason',
                form('it', "('x', { sk", 'ip: "flaky" }, () => {});')
            ],
            ['a todo option set to true', form('test', "('x', { to", 'do: true }, () => {});')],
            [
                'a todo option with a reason',
                form('test', "('x', { to", "do: 'later' }, () => {});")
            ],
            [
                'an expectFailure option set to true',
                form('test', "('x', { expect", 'Failure: true }, () => {});')
            ],
            [
                'an expectFailure option with a reason',
                form('test', "('x', { expect", "Failure: 'known' }, () => {});")
            ],
            ['a fails option set to true', form('it', "('x', { fa", 'ils: true }, () => {});')],
            ['a describe skip option', form('describe', "('x', { sk", 'ip: true }, () => {});')],
            ['a suite skip option', form('suite', "('x', { sk", 'ip: true }, () => {});')],
            [
                'an options object ahead of the name',
                form('test', '({ sk', 'ip: true }, () => {});')
            ],
            [
                'a skip option on a table',
                form('it', ".each([1])('x %i', { sk", 'ip: true }, () => {});')
            ],
            [
                'a skip option behind other options',
                form('it', "('x', { timeout: 5, sk", 'ip: true }, f);')
            ],

            /* Playwright annotations: a skip or fixme annotation skips the test, a fail one inverts it. */
            [
                'an annotation of type skip',
                form('test', "('x', { annotation: { type: '", "skip' } }, () => {});")
            ],
            [
                'an annotation of type fixme',
                form('test', "('x', { annotation: { type: '", "fixme' } }, () => {});")
            ],
            [
                'an annotation of type fail',
                form('test', "('x', { annotation: { type: '", "fail' } }, () => {});")
            ],
            [
                'an annotation of type skip in a double-quoted string',
                form('test', "('x', { annotation: { type: \"", 'skip" } }, () => {});')
            ],
            [
                'an annotation list that holds a skip',
                form(
                    'test',
                    "('x', { annotation: [{ type: 'issue' }, { type: '",
                    "fixme' }] }, f);"
                )
            ],
            [
                'an annotation on a describe',
                form('test.describe', "('x', { annotation: { type: '", "skip' } }, () => {});")
            ],

            /* A comment is not an argument, a key or a closing bracket, wherever it sits in the call. */
            [
                'a skipIf with a block comment before its constant',
                form('it', '.skip', "If(/* off */ true)('x', f);")
            ],
            [
                'a skipIf with a block comment after its constant',
                form('it', '.skip', "If(true /* off */)('x', f);")
            ],
            [
                'a skipIf with a line comment before its constant',
                form('it', '.skip', "If(// off\n true)('x', f);")
            ],
            [
                'a runIf with a line comment after its constant',
                form('it', '.run', "If(false // off\n)('x', f);")
            ],
            [
                'a skipIf whose comment holds a closing parenthesis',
                form('it', '.skip', "If(/* ) */ true)('x', f);")
            ],
            ['a bare skip with only a comment inside', form('test', '.sk', 'ip(/* why */);')],
            ['a skip whose title follows a comment', form('test', '.sk', "ip(/* why */ 'title');")],
            [
                'a block comment between the title and the options',
                form('it', "('x', /* opts */ { sk", 'ip: true }, f);')
            ],
            [
                'a block comment ahead of the options in first position',
                form('it', '(/* opts */ { sk', 'ip: true }, f);')
            ],
            [
                'a comment with a comma between the title and the options',
                form('it', "('x' /* a, b */, { sk", 'ip: true }, f);')
            ],
            [
                'a comment with a closing parenthesis between the title and the options',
                form('it', "('x' /* ) */, { sk", 'ip: true }, f);')
            ],
            [
                'a skip option with a comment after its value',
                form('it', "('x', { sk", 'ip: true /* known */ }, f);')
            ],
            [
                'a skip option with a comment before its value',
                form('it', "('x', { sk", 'ip: /* known */ true }, f);')
            ],
            [
                'a brace in a comment inside the options',
                form('it', "('x', { /* } */ sk", 'ip: true }, f);')
            ],

            [
                'a skipIf with a comment on each side of its constant',
                form('it', '.skip', "If(/* a */ true /* b */)('x', f);")
            ],

            /* A string or a template literal may hold what would end an argument, and nest another. */
            [
                'a title with a comma in single quotes, then the options',
                form('it', "('a, b', { sk", 'ip: true }, f);')
            ],
            [
                'a title with a comma in double quotes, then the options',
                form('it', '("a, b", { sk', 'ip: true }, f);')
            ],
            [
                'a title with a comma in a template literal, then the options',
                form('it', '(`a, b`, { sk', 'ip: true }, f);')
            ],
            [
                'a title with an escaped quote, then the options',
                form('it', "('don\\'t', { sk", 'ip: true }, f);')
            ],
            [
                'a title with an escaped backtick, then the options',
                form('it', '(`a\\`, b`, { sk', 'ip: true }, f);')
            ],
            [
                'a title built from nested template expressions, then the options',
                form('it', "(`${a ? `x, y` : 'z'}`, { sk", 'ip: true }, f);')
            ]
        ];
        const CONDITIONAL = [
            [
                'a skipIf on a platform',
                form('it', '.skip', "If(process.platform === 'win32')('x', f);")
            ],
            [
                'a describe skipIf on a flag',
                form('describe', '.skip', "If(!hasLsof)('x', () => {});")
            ],
            ['a runIf on an environment value', form('it', '.run', "If(process.env.CI)('x', f);")],
            ['a describe runIf on a flag', form('describe', '.run', "If(isLinux)('x', () => {});")],

            /* A constant that never switches the test off decides nothing, so it needs no quarantine. */
            ['skipIf with false', form('it', '.skip', "If(false)('x', () => {});")],
            ['skipIf with 0', form('it', '.skip', "If(0)('x', () => {});")],
            ['skipIf with null', form('it', '.skip', "If(null)('x', () => {});")],
            ['skipIf with undefined', form('it', '.skip', "If(undefined)('x', () => {});")],
            ['describe skipIf with false', form('describe', '.skip', "If(false)('x', () => {});")],
            ['runIf with true', form('it', '.run', "If(true)('x', () => {});")],
            ['runIf with 1', form('it', '.run', "If(1)('x', () => {});")],
            ['describe runIf with true', form('describe', '.run', "If(true)('x', () => {});")],
            [
                'a runIf on a table that holds true',
                form('it', '.run', "If(true).each([1])('x %i', f);")
            ],

            /* Playwright and the test context: a condition, or a constant that is false. */
            [
                'a Playwright skip on a condition',
                form('test', '.sk', "ip(browserName === 'webkit', 'why');")
            ],
            ['a Playwright fixme on a condition', form('test', '.fix', "me(isMobile, 'why');")],
            ['a Playwright fail on a condition', form('test', '.fail', "(isCi, 'why');")],
            ['a Playwright skip with false', form('test', '.sk', 'ip(false);')],
            ['a Playwright fixme with false', form('test', '.fix', "me(false, 'why');")],
            ['a Playwright fail with 0', form('test', '.fail', '(0);')],
            ['a testInfo skip on a condition', form('testInfo', '.sk', "ip(isMobile, 'why');")],
            ['a context skip on a condition', form('ctx', '.sk', "ip(!hasLsof, 'no lsof');")],
            [
                'a Playwright skip on a function',
                form('test', '.sk', "ip(({ browserName }) => browserName === 'x', 'why');")
            ],
            [
                'a skip on a condition with an undefined note',
                form('test', '.sk', 'ip(isCi, undefined);')
            ],
            ['a skip on a condition with a trailing comma', form('test', '.sk', 'ip(isCi, );')],
            [
                'a skip on a condition with its note in a template',
                form('test', '.sk', 'ip(isCi, `no ${tool}`);')
            ],
            ['an it todo placeholder', form('it', '.to', "do('x');")],
            ['a describe todo placeholder', form('describe', '.to', "do('x');")],
            ['a test todo placeholder', form('test', '.to', "do('x');")],
            ['a todo placeholder whose title is a variable', form('it', '.to', 'do(title);')],
            ['an assertion that fails', form('assert', '.fail', "('x');")],
            [
                'a skip on a condition with a function on the next line, written without semicolons',
                form('test', '.sk', 'ip(isCi)') + '\nasync function helper() {}'
            ],
            [
                'a modifier whose receiver is a template placeholder',
                form("const line = `${'it'}", '.sk', "ip('x', f)`;")
            ],
            ['an expect that fails', form('expect', '.fail', "('x');")],
            ['a context assertion that fails', form('t.assert', '.fail', "('x');")],
            ['a promise that fails', form('deferred', '.fail', '(new Error(error));')],
            ['an only call on another object', form('schema', '.only', "('x');")],
            ['an expectFailure on another object', form('mock', '.expect', "Failure('x');")],
            ['a fails call on an assertion', form('assertion.not.to', '.fa', 'ils();')],
            ['a failing call on another object', form('job', '.fail', 'ing(error);')],

            /* The options object with a condition, a falsy constant, a shorthand or an unrelated key. */
            [
                'a skip option on a platform',
                form('it', "('x', { sk", "ip: process.platform === 'win32' }, f);")
            ],
            ['a skip option on a flag', form('it', "('x', { sk", 'ip: !hasLsof }, f);')],
            ['a skip option set to false', form('it', "('x', { sk", 'ip: false }, f);')],
            ['a skip option set to 0', form('it', "('x', { sk", 'ip: 0 }, f);')],
            [
                'an option whose name merely ends in skip',
                form('it', "('x', { re", 'sk', 'ip: true }, f);')
            ],
            ['a todo option on a flag', form('test', "('x', { to", 'do: isNightly }, f);')],
            ['a todo option set to false', form('test', "('x', { to", 'do: false }, f);')],
            [
                'an expectFailure option set to false',
                form('test', "('x', { expect", 'Failure: false }, f);')
            ],
            ['a fails option set to false', form('it', "('x', { fa", 'ils: false }, f);')],
            ['a shorthand skip option', form('it', "('x', { sk", 'ip }, f);')],
            ['an options object with only a timeout', form('it', "('x', { timeout: 5 }, f);")],
            [
                'an annotation of another type',
                form(
                    'test',
                    "('x', { annotation: { type: 'issue', description: 'sk",
                    "ip this' } }, f);"
                )
            ],
            ['a tag that merely says skip', form('test', "('x', { tag: '@sk", "ip' }, f);")],

            /* Keys and calls outside a test declaration are somebody else's business. */
            ['a skip key in a plain object', form('const page = { sk', 'ip: true, take: 5 };')],
            ['a hook option', form('const result = useGetThingQuery(id, { sk', 'ip: true });')],
            ['a skip property read', form('const n = args', '.sk', 'ip;')],
            ['a todo key in a fixture', form('const row = { to', "do: 'buy milk' };")],
            ['a skip alias that is not a call', form('const run = flag ? it : it', '.sk', 'ip;')],

            /* A comment in the call changes nothing about a condition that is a condition. */
            [
                'a skipIf with a block comment before its condition',
                form('it', '.skip', "If(/* ci only */ isCi)('x', f);")
            ],
            [
                'a skipIf with a block comment after its condition',
                form('it', '.skip', "If(isCi /* ci only */)('x', f);")
            ],
            [
                'a runIf with a line comment before its condition',
                form('it', '.run', "If(// ci only\n isCi)('x', f);")
            ],
            [
                'a skip with a block comment before its note',
                form('test', '.sk', "ip(isCi, /* reason */ 'why');")
            ],
            [
                'a skip with a line comment before its note',
                form('test', '.sk', "ip(isCi, // reason\n 'why');")
            ],
            [
                'a skip whose comment holds a closing parenthesis',
                form('test', '.sk', "ip(isCi /* ci only) */, 'why');")
            ],
            [
                'a skip whose comment holds a comma and parentheses',
                form('test', '.sk', "ip(isCi /* (ci), local */, 'why');")
            ],
            [
                'a skip whose comment holds a quote',
                form('test', '.sk', "ip(isCi /* don't */, 'why');")
            ],
            [
                'a skip option with a block comment before a false value',
                form('it', "('x', { sk", 'ip: /* off */ false }, f);')
            ],
            [
                'a skip option with a line comment before a false value',
                form('it', "('x', { sk", 'ip: // off\n false }, f);')
            ],
            [
                'a skip with a comment on each side of its condition',
                form('test', '.sk', "ip(/* a */ isCi /* b */, 'why');")
            ],

            /* A comment is white space: it never glues what it separates into a constant. */
            [
                'a skipIf whose constant is cut in two by a comment',
                form('it', '.skip', "If(tr/**/ue)('x', f);")
            ],
            [
                'a skip option whose constant is cut in two by a comment',
                form('it', "('x', { sk", 'ip: tr/**/ue }, f);')
            ],

            /* A string or a template literal may hold what would end an argument, and nest another. */
            [
                'a skip on a condition with an escaped backtick',
                form('test', '.sk', "ip(env === `a\\`, b`, 'why');")
            ],
            [
                'a skip on a condition built from nested template expressions',
                form('test', '.sk', "ip(env === `${a ? `x, y` : 'z'}`, 'why');")
            ],
            [
                'a skipIf on a condition built from nested template expressions',
                form('it', '.skip', "If(env === `${a ? `x, y` : 'z'}`)('x', f);")
            ]
        ];

        /* Not read, and said so in the scanner's own note of what it does not read. A subtest is
           declared through the test context (`t`, `ctx`), whose name is the author's; `.test(` is
           also the RegExp method; and a name that merely ends in `test` is another function. Only
           `test`, `it`, `describe` and `suite`, not members of another object, declare a test. */
        const NOT_READ = [
            ['a subtest with a skip option', form('t', ".test('x', { sk", 'ip: true }, f);')],
            [
                'a subtest with an expectFailure option',
                form('t', ".test('x', { expect", 'Failure: true }, f);')
            ],
            ['a subtest with a todo option', form('t', ".test('x', { to", "do: 'later' }, f);")],
            [
                'a subtest with its options ahead of the name',
                form('t', '.test({ sk', 'ip: true }, f);')
            ],
            [
                'an awaited subtest',
                form('await t', ".test('x', { sk", 'ip: true }, async () => {});')
            ],
            ['a subtest on a context named ctx', form('ctx', ".test('x', { sk", 'ip: true }, f);')],
            ['a regular expression test', form('PATTERN', '.test(line);')],
            [
                'a regular expression test given an object',
                form('PATTERN', '.test({ sk', 'ip: true });')
            ],
            [
                'a function whose name ends in test',
                form('con', 'test', "('x', { sk", 'ip: true }, f);')
            ],
            [
                'a function whose name starts with a dollar sign',
                form('$', 'test', "('x', { sk", 'ip: true }, f);')
            ]
        ];

        for (const [name, line] of UNCONDITIONAL) {
            it(`flags ${name} that carries no quarantine`, () => {
                const findings = checkQuarantine({ tests: [['i.test.ts', line]], today });
                assert.equal(findings.length, 1);
                assert.ok(findings[0].includes('i.test.ts:1'));
                assert.ok(findings[0].includes('quarantine until YYYY-MM-DD'));
            });

            it(`holds ${name} to the date: live passes, expired is red`, () => {
                const under = (date) => [
                    ['i.test.ts', `// quarantine until ${date}: waits on the fix\n${line}`]
                ];
                assert.deepEqual(checkQuarantine({ tests: under('2026-09-20'), today }), []);
                assert.equal(checkQuarantine({ tests: under(today), today }).length, 1);
                assert.equal(checkQuarantine({ tests: under('2099-12-31'), today }).length, 1);
            });
        }

        for (const [name, line] of CONDITIONAL) {
            it(`accepts ${name} without a quarantine`, () => {
                assert.deepEqual(checkQuarantine({ tests: [['i.test.ts', line]], today }), []);
            });
        }

        for (const [name, line] of NOT_READ) {
            it(`does not read ${name}`, () => {
                assert.deepEqual(findSwitchedOff(line), []);
                assert.deepEqual(checkQuarantine({ tests: [['i.test.ts', line]], today }), []);
            });
        }

        it('reads the very options a subtest hides once the call is a declaration', () => {
            const declared = [
                form('it', "('x', { sk", 'ip: true }, f);'),
                form('test', "('x', { expect", 'Failure: true }, f);'),
                form('describe', "('x', { to", "do: 'later' }, f);"),
                form('suite', '({ sk', 'ip: true }, f);')
            ];
            for (const line of declared) {
                assert.equal(checkQuarantine({ tests: [['i.test.ts', line]], today }).length, 1);
            }
        });

        const FOCUSED = [
            ['it only each', form('it', '.only', ".each([1])('x %i', () => {});")],
            ['describe only each', form('describe', '.only', ".each([1])('x', () => {});")],
            ['a Jest fit', form('f', 'it', "('x', () => {});")],
            ['a Jest fdescribe', form('f', 'describe', "('x', () => {});")],
            ['a Jest fit table', form('f', 'it', ".each([1])('x %i', () => {});")],
            ['a Jest fit failing', form('f', 'it', ".failing('x', () => {});")],
            ['a Jest fdescribe table', form('f', 'describe', ".each([1])('x', () => {});")],
            ['a Playwright describe only', form('test.describe', '.only', "('x', () => {});")],
            ['a Playwright serial only', form('test.describe.serial', '.only', "('x', () => {});")],
            [
                'a Playwright parallel only',
                form('test.describe.parallel', '.only', "('x', () => {});")
            ],
            ['a concurrent only', form('it', '.concurrent', '.only', "('x', () => {});")],
            ['a suite only', form('suite', '.only', "('x', () => {});")],
            ['an only option', form('it', "('x', { on", 'ly: true }, () => {});')],
            [
                'an only option on a describe',
                form('describe', "('x', { on", 'ly: true }, () => {});')
            ]
        ];
        for (const [name, line] of FOCUSED) {
            it(`flags ${name} as a focused test`, () => {
                const findings = checkQuarantine({ tests: [['i.test.ts', line]], today });
                assert.equal(findings.length, 1);
                assert.ok(findings[0].includes('a focused test'));
            });
        }

        it('does not call an only option set to false a focused test', () => {
            const line = form('it', "('x', { on", 'ly: false }, () => {});');
            assert.deepEqual(checkQuarantine({ tests: [['i.test.ts', line]], today }), []);
        });

        it('flags a focused expected failure twice: once as focused, once as switched off', () => {
            const line = form('test', '.fail', ".only('x', () => {});");
            const findings = checkQuarantine({ tests: [['i.test.ts', line]], today });
            assert.equal(findings.length, 2);
            assert.equal(
                findings.some((finding) => finding.includes('a focused test')),
                true
            );
            assert.equal(
                findings.some((finding) => finding.includes('quarantine until')),
                true
            );
        });

        it('names each hit with its position, label and kind', () => {
            const text = [
                form('it', '.sk', "ip('a', f);"),
                form('it', '.only', "('b', f);"),
                form('it', '.skip', "If(isCi)('c', f);")
            ].join('\n');
            const hits = findSwitchedOff(text);
            assert.deepEqual(
                hits.map((hit) => hit.label),
                ['.skip', '.only', '.skipIf']
            );
            assert.deepEqual(
                hits.map((hit) => hit.unconditional),
                [true, undefined, false]
            );
            assert.deepEqual(
                hits.map((hit) => hit.focused),
                [undefined, true, undefined]
            );
            assert.deepEqual(
                hits.map((hit) => text.slice(hit.index, hit.index + 5)),
                ['.skip', '.only', '.skip']
            );
        });

        it('does not mistake an identifier that merely ends in it for a Jest form', () => {
            const tests = [['i.test.ts', "const fit = hit('x'); exit('x'); taxit('y');"]];
            assert.deepEqual(checkQuarantine({ tests, today }), []);
        });

        it('does not mistake a helper or an object called fit for a Jest form', () => {
            const tests = [
                ['i.test.ts', 'const fit = makeFit(); fit.fit(); fit.width = 3; fit.dispose();']
            ];
            assert.deepEqual(checkQuarantine({ tests, today }), []);
        });

        it('reads a call, not a word in a comment', () => {
            const prose = form('// never write it', '.skip or describe', '.skipIf in a spec');
            assert.deepEqual(checkQuarantine({ tests: [['i.test.ts', prose]], today }), []);
        });

        it('reads a call, not a code span in a comment', () => {
            const prose = form(
                '// a focused test (`it',
                '.only`) or a skipped one (`it',
                '.skip`) is refused'
            );
            assert.deepEqual(checkQuarantine({ tests: [['i.test.ts', prose]], today }), []);
        });

        it('reads a call, not a title that mentions a switch', () => {
            const tests = [
                ['i.test.ts', "it('does not skip the step', () => {}); it('todo: nothing', f);"]
            ];
            assert.deepEqual(checkQuarantine({ tests, today }), []);
        });

        /* The same switches across lines, the way prettier lays a long call out. */
        describe('a call laid out over several lines', () => {
            const lines = (...rows) => rows.join('\n');
            const MULTI_LINE = [
                [
                    'a skip with the constant on the next line',
                    lines(form('test', '.sk', 'ip('), '    true,', "    'why'", ');')
                ],
                [
                    'a declaration with the annotation on its own line',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        form("    { annotation: { type: '", "skip' } },"),
                        '    async () => {}',
                        ');'
                    )
                ],
                [
                    'an options object spread over lines',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        '    {',
                        form('        sk', 'ip: true'),
                        '    },',
                        '    async () => {}',
                        ');'
                    )
                ],
                [
                    'a modifier on the line after its receiver',
                    lines('it', form('    .sk', "ip('x', f);"))
                ],
                [
                    'a modifier on the line after its receiver, behind an optional chain',
                    lines('ctx?', form('    .sk', 'ip();'))
                ],
                [
                    'a modifier on the line after its dot',
                    lines('it.', form('    sk', "ip('x', f);"))
                ],
                [
                    'a skipIf with the constant on the next line',
                    lines(form('it', '.skip', 'If('), '    true', ")('x', f);")
                ],
                [
                    'a table whose options sit in the second call',
                    lines(
                        form('it', '.each([', '    1,', '    2', '])('),
                        "    'x %i',",
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],

                /* The comments prettier leaves between the arguments, and what they may hold. */
                [
                    'a line comment above the options object',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        '    // flaky on CI',
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],
                [
                    'a block comment above the options object',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        '    /* flaky on CI */',
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],
                [
                    'a comment with a quote above the options object',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        "    // don't run on CI",
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],
                [
                    'a comment with parentheses and a comma above the options object',
                    lines(
                        form('test', '('),
                        "    'a long title',",
                        '    // flaky (on CI), see the board',
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],
                [
                    'a comment between the cases of a table and its options',
                    lines(
                        form('it', '.each([1, 2])('),
                        "    'x %i',",
                        '    // flaky on CI',
                        form('    { sk', 'ip: true },'),
                        '    f',
                        ');'
                    )
                ],
                [
                    'a comment with a brace inside the options object',
                    lines(
                        form('test', "('x', {"),
                        '    // } closes nothing',
                        form('    sk', 'ip: true'),
                        '}, f);'
                    )
                ],
                [
                    'a skip option set to true, with a comment after it',
                    lines(
                        form('test', "('a long title', {"),
                        form('    sk', 'ip: true // waits on the fix'),
                        '}, f);'
                    )
                ],
                [
                    'a skipIf whose constant sits on its own line, below a comment',
                    lines(
                        form('it', '.skip', 'If('),
                        '    // not on this runner',
                        '    true',
                        ")('x', f);"
                    )
                ],

                /* A quote that is never closed ends at its line: it cannot swallow what comes after. */
                [
                    'a regular expression with a lone quote, then a test with a skip option',
                    lines(
                        form('it', "('a', {"),
                        "    grep: /don't/",
                        '}, f);',
                        form('it', "('b', { sk", 'ip: true }, f);')
                    )
                ]
            ];

            for (const [name, source] of MULTI_LINE) {
                it(`flags ${name}`, () => {
                    const findings = checkQuarantine({ tests: [['m.test.ts', source]], today });
                    assert.equal(findings.length, 1);
                    assert.ok(findings[0].includes('quarantine until YYYY-MM-DD'));
                });
            }

            it('accepts a condition on the next line, comments and all', () => {
                const source = lines(
                    form('test', '.sk', 'ip('),
                    "    // don't run where the browser has no support",
                    "    browserName === 'webkit',",
                    "    'why'",
                    ');'
                );
                assert.deepEqual(checkQuarantine({ tests: [['m.test.ts', source]], today }), []);
            });

            it('accepts a condition and its note with a comment between them', () => {
                const source = lines(
                    form('test', '.sk', 'ip('),
                    '    isCi, // see (the ci docs), not local',
                    "    'why'",
                    ');'
                );
                assert.deepEqual(checkQuarantine({ tests: [['m.test.ts', source]], today }), []);
            });

            it('accepts a skip option set to false, comments and all', () => {
                const source = lines(
                    form('test', "('a long title', {"),
                    form('    sk', 'ip: false // waits on the fix'),
                    '}, f);'
                );
                assert.deepEqual(checkQuarantine({ tests: [['m.test.ts', source]], today }), []);
            });

            it('reads the test after a lone quote once, not once per object that reaches it', () => {
                const source = lines(
                    form('it', "('a', {"),
                    "    grep: /don't/",
                    '}, f);',
                    form('it', "('b', { sk", 'ip: true }, f);')
                );
                const hits = findSwitchedOff(source);
                assert.equal(hits.length, 1);
                assert.equal(source.slice(0, hits[0].index).split('\n').length, 4);
            });

            it('looks for the quarantine above the line that holds the switch', () => {
                const withMarker = lines(
                    form('test', '('),
                    "    'a long title',",
                    '    {',
                    '        // quarantine until 2026-09-20: waits on the fix',
                    form('        sk', 'ip: true'),
                    '    },',
                    '    f',
                    ');'
                );
                const tooFar = lines(
                    '// quarantine until 2026-09-20: waits on the fix',
                    form('test', '('),
                    "    'a long title',",
                    '    {',
                    form('        sk', 'ip: true'),
                    '    },',
                    '    f',
                    ');'
                );
                assert.deepEqual(
                    checkQuarantine({ tests: [['m.test.ts', withMarker]], today }),
                    []
                );
                assert.equal(checkQuarantine({ tests: [['m.test.ts', tooFar]], today }).length, 1);
            });

            it('names the line of the switch, not the line the call starts on', () => {
                const source = lines(
                    form('test', '('),
                    "    'a long title',",
                    form("    { annotation: { type: '", "skip' } },"),
                    '    f',
                    ');'
                );
                const [finding] = checkQuarantine({ tests: [['m.test.ts', source]], today });
                assert.ok(finding.includes('m.test.ts:3'));
            });

            it('reports the switches in the order they sit in the file', () => {
                const source = lines(
                    form('x', 'it', "('a', f);"),
                    form('it', '.sk', "ip('b', f);")
                );
                const findings = checkQuarantine({ tests: [['o.test.ts', source]], today });
                assert.equal(findings.length, 2);
                assert.ok(findings[0].includes('o.test.ts:1'));
                assert.ok(findings[1].includes('o.test.ts:2'));
            });

            it('counts a quarantine on the switch line or the two lines above it, never below', () => {
                const marker = '// quarantine until 2026-09-20: waits on the fix';
                const switched = form('it', '.sk', "ip('x', f);");
                const flagged = (source) =>
                    checkQuarantine({ tests: [['w.test.ts', source]], today }).length;
                assert.equal(flagged(`${switched} ${marker}`), 0);
                assert.equal(flagged(lines(marker, switched)), 0);
                assert.equal(flagged(lines(marker, '// more of the reason', switched)), 0);
                assert.equal(flagged(lines(marker, '// one', '// two', switched)), 1);
                assert.equal(flagged(lines(switched, marker)), 1);
            });
        });

        /* skipIf switches off when its constant is truthy, runIf when its constant is falsy. */
        describe('skipIf and runIf read the constant the right way round', () => {
            const SKIPPED = [
                ['skipIf', 'true'],
                ['skipIf', '1'],
                ['runIf', 'false'],
                ['runIf', '0'],
                ['runIf', 'null'],
                ['runIf', 'undefined']
            ];
            const RUNS = [
                ['skipIf', 'false'],
                ['skipIf', '0'],
                ['skipIf', 'null'],
                ['skipIf', 'undefined'],
                ['runIf', 'true'],
                ['runIf', '1']
            ];
            const call = (modifier, constant) =>
                form('it', modifier === 'skipIf' ? '.skip' : '.run', `If(${constant})('x', f);`);

            for (const [modifier, constant] of SKIPPED) {
                it(`is red for ${modifier}(${constant}), which never runs the test`, () => {
                    const findings = checkQuarantine({
                        tests: [['p.test.ts', call(modifier, constant)]],
                        today
                    });
                    assert.equal(findings.length, 1);
                    assert.ok(findings[0].includes(`\`.${modifier}\``));
                });
            }

            for (const [modifier, constant] of RUNS) {
                it(`is green for ${modifier}(${constant}), which always runs the test`, () => {
                    const tests = [['p.test.ts', call(modifier, constant)]];
                    assert.deepEqual(checkQuarantine({ tests, today }), []);
                });
            }

            it('keeps a real condition green whichever way round it is read', () => {
                const tests = [
                    ['p.test.ts', form('it', '.skip', "If(process.env.CI)('x', f);")],
                    ['q.test.ts', form('it', '.run', "If(process.env.CI)('x', f);")]
                ];
                assert.deepEqual(checkQuarantine({ tests, today }), []);
            });
        });
    });
});

describe('listTestFiles', () => {
    it('finds this suite and never looks inside node_modules', () => {
        const files = listTestFiles(process.cwd());
        assert.ok(files.includes('scripts/docs-check.test.mjs'));
        assert.equal(
            files.some((file) => file.includes('node_modules')),
            false
        );
    });
});

describe('isPullRequestTriggered', () => {
    it('reads the on: block before jobs:, not a step that merely mentions pull_request', () => {
        const prWorkflow =
            'name: CI\non:\n    pull_request:\n        branches: [main]\njobs:\n    build:\n';
        const scheduleOnly =
            'name: Docs\non:\n    schedule:\n        - cron: "0 6 * * 2"\njobs:\n    docs:\n        steps:\n            - run: echo pull_request\n';
        assert.equal(isPullRequestTriggered(prWorkflow), true);
        assert.equal(isPullRequestTriggered(scheduleOnly), false);
    });
});

describe('extractRunSteps', () => {
    it('collects a single-line run: step with its own line number', () => {
        const text =
            'jobs:\n    build:\n        steps:\n            - name: Install\n              run: npm ci\n';
        assert.deepEqual(extractRunSteps(text), [{ command: 'npm ci', line: 5 }]);
    });

    // A block scalar must not be skipped outright: a check added as a multi-line step would
    // otherwise bypass the run-step allowlist with docs:check green.
    it('reads every non-empty line inside a run: | block scalar, each with its own line number', () => {
        const text = [
            'jobs:',
            '    build:',
            '        steps:',
            '            - name: Multi',
            '              run: |',
            '                  npm ci --ignore-scripts',
            '',
            '                  npm run lint:extra'
        ].join('\n');
        assert.deepEqual(extractRunSteps(text), [
            { command: 'npm ci --ignore-scripts', line: 6 },
            { command: 'npm run lint:extra', line: 8 }
        ]);
    });

    it('stops a block at the first line indented back to the run: key or less', () => {
        const text = [
            'jobs:',
            '    build:',
            '        steps:',
            '            - name: Multi',
            '              run: |',
            '                  npm ci',
            '            - name: Next',
            '              run: npm run build'
        ].join('\n');
        assert.deepEqual(extractRunSteps(text), [
            { command: 'npm ci', line: 6 },
            { command: 'npm run build', line: 8 }
        ]);
    });

    // A step whose first key is `run:` is written `- run: ...`; a parser that wants `run:` at the
    // start of the line never sees it, and the step passes the allowlist unchecked.
    it('collects a run: step written on the dash line itself', () => {
        const text = 'jobs:\n    build:\n        steps:\n            - run: npm ci\n';
        assert.deepEqual(extractRunSteps(text), [{ command: 'npm ci', line: 4 }]);
    });

    it('ends a block that starts on the dash line at the next key of the same step', () => {
        const text = [
            'jobs:',
            '    build:',
            '        steps:',
            '            - run: |',
            '                  npm ci',
            '              env:',
            '                  KEY: value',
            '            - run: npm run build'
        ].join('\n');
        assert.deepEqual(extractRunSteps(text), [
            { command: 'npm ci', line: 5 },
            { command: 'npm run build', line: 8 }
        ]);
    });
});

describe('checkCiRunSteps', () => {
    const workflow = [
        'name: CI',
        'on:',
        '    pull_request:',
        '        branches: [main]',
        'jobs:',
        '    build:',
        '        steps:',
        '            - name: Install',
        '              run: npm ci --ignore-scripts',
        '            - name: Extra lint sweep',
        '              run: npm run lint:extra'
    ].join('\n');

    it('flags a run step outside the allowlist, naming the file and line, and accepts an allowed one', () => {
        const findings = checkCiRunSteps({
            workflows: [['.github/workflows/ci.yml', workflow]],
            allowedRunSteps: [{ run: 'npm ci --ignore-scripts', reason: 'install, not a check' }]
        });
        assert.deepEqual(findings, [
            '.github/workflows/ci.yml:11: CI runs "npm run lint:extra" outside the gate. Put it into verify, or list it in scripts/gate-tiers.json ci.allowedRunSteps with a reason.'
        ]);
    });

    it('ignores a workflow that does not trigger on pull_request', () => {
        const scheduleOnly = workflow.replace('pull_request:', 'schedule:');
        assert.deepEqual(
            checkCiRunSteps({
                workflows: [['.github/workflows/docs.yml', scheduleOnly]],
                allowedRunSteps: []
            }),
            []
        );
    });

    // A block step holding one allowed line and one unknown one must flag exactly the unknown
    // line, at its own position inside the block.
    it('checks each line inside a run: | block, flagging only the unknown command', () => {
        const blockWorkflow = [
            'name: CI',
            'on:',
            '    pull_request:',
            '        branches: [main]',
            'jobs:',
            '    build:',
            '        steps:',
            '            - name: Multi',
            '              run: |',
            '                  npm ci --ignore-scripts',
            '                  npm run lint:extra'
        ].join('\n');
        const findings = checkCiRunSteps({
            workflows: [['.github/workflows/ci.yml', blockWorkflow]],
            allowedRunSteps: [{ run: 'npm ci --ignore-scripts', reason: 'install, not a check' }]
        });
        assert.deepEqual(findings, [
            '.github/workflows/ci.yml:11: CI runs "npm run lint:extra" outside the gate. Put it into verify, or list it in scripts/gate-tiers.json ci.allowedRunSteps with a reason.'
        ]);
    });

    it('flags an unknown step written on the dash line', () => {
        const dashWorkflow = [
            'name: CI',
            'on:',
            '    pull_request:',
            '        branches: [main]',
            'jobs:',
            '    build:',
            '        steps:',
            '            - run: npm run lint:extra'
        ].join('\n');
        const findings = checkCiRunSteps({
            workflows: [['.github/workflows/ci.yml', dashWorkflow]],
            allowedRunSteps: []
        });
        assert.deepEqual(findings, [
            '.github/workflows/ci.yml:8: CI runs "npm run lint:extra" outside the gate. Put it into verify, or list it in scripts/gate-tiers.json ci.allowedRunSteps with a reason.'
        ]);
    });
});

describe('checkPullRequestReadPermission', () => {
    const FILE = '.github/workflows/security.yml';
    const workflow = ({ trigger = 'pull_request', top = [], job = [] } = {}) =>
        [
            'name: Security',
            'on:',
            `    ${trigger}:`,
            ...top,
            'jobs:',
            '    gitleaks:',
            '        runs-on: ubuntu-latest',
            ...job,
            '        steps:',
            '            - uses: actions/checkout@abc # v1',
            '            - name: Run gitleaks',
            '              uses: gitleaks/gitleaks-action@def # v3',
            '    other:',
            '        runs-on: ubuntu-latest',
            '        steps:',
            '            - run: echo ok'
        ].join('\n');
    const READ_CONTENTS = ['        permissions:', '            contents: read'];
    const READ_BOTH = [...READ_CONTENTS, '            pull-requests: read'];
    const check = (text) => checkPullRequestReadPermission({ workflows: [[FILE, text]] });

    it('flags a gitleaks job on a pull_request trigger whose permissions lack pull-requests: read', () => {
        const findings = check(workflow({ job: READ_CONTENTS }));

        assert.equal(findings.length, 1);
        assert.match(findings[0], /^\.github\/workflows\/security\.yml:\d+: /);
        assert.match(findings[0], /job "gitleaks"/);
        assert.match(findings[0], /pull-requests: read/);
        assert.match(findings[0], /403/);
    });

    it('points at the uses line of the action', () => {
        const text = workflow({ job: READ_CONTENTS });
        const line =
            text.split('\n').findIndex((row) => row.includes('gitleaks/gitleaks-action')) + 1;

        assert.match(check(text)[0], new RegExp(`:${String(line)}: `));
    });

    it('accepts the scope on the job, and a write or a blanket grant on the job', () => {
        assert.deepEqual(check(workflow({ job: READ_BOTH })), []);
        assert.deepEqual(
            check(workflow({ job: ['        permissions:', '            pull-requests: write'] })),
            []
        );
        assert.deepEqual(check(workflow({ job: ['        permissions: read-all'] })), []);
    });

    it('does not read pull-requests: none as a grant, on the job or on the workflow', () => {
        const none = ['        permissions:', '            pull-requests: none'];
        const top = ['', 'permissions:', '    pull-requests: none', ''];

        assert.equal(check(workflow({ job: none })).length, 1);
        assert.equal(check(workflow({ top })).length, 1);
    });

    it('reads a blanket grant that carries a trailing comment', () => {
        assert.deepEqual(
            check(workflow({ job: ['        permissions: read-all # lists the commits'] })),
            []
        );
    });

    it('takes the workflow-level grant only when the job declares no permissions of its own', () => {
        const top = ['', 'permissions:', '    contents: read', '    pull-requests: read', ''];
        const noJobBlock = workflow({ top });
        assert.deepEqual(check(noJobBlock), []);

        // A job-level block replaces the workflow-level one entirely, it does not add to it.
        assert.equal(check(workflow({ top, job: READ_CONTENTS })).length, 1);
    });

    it('flags a gitleaks job with no permissions at all when the workflow grants only contents', () => {
        const top = ['', 'permissions:', '    contents: read', ''];

        assert.equal(check(workflow({ top })).length, 1);
    });

    it('reads a job whose permissions are indented by two spaces, not four', () => {
        const twoSpaces = [
            'on:',
            '  pull_request:',
            'jobs:',
            '  gitleaks:',
            '    permissions:',
            '      pull-requests: read',
            '    steps:',
            '      - uses: gitleaks/gitleaks-action@aaa'
        ].join('\n');

        assert.deepEqual(check(twoSpaces), []);
        assert.equal(check(twoSpaces.replace('pull-requests: read', 'contents: read')).length, 1);
    });

    it('leaves a workflow that is not pull_request triggered, and a job without the action', () => {
        assert.deepEqual(check(workflow({ trigger: 'push', job: READ_CONTENTS })), []);
        assert.deepEqual(
            check(
                [
                    'on:',
                    '    pull_request:',
                    'jobs:',
                    '    a:',
                    '        steps:',
                    '            - run: echo'
                ].join('\n')
            ),
            []
        );
    });

    it('flags each gitleaks job of a workflow separately', () => {
        const twice = [
            'on:',
            '    pull_request:',
            'jobs:',
            '    first:',
            '        permissions:',
            '            contents: read',
            '        steps:',
            '            - uses: gitleaks/gitleaks-action@aaa',
            '    second:',
            '        permissions:',
            '            contents: read',
            '            pull-requests: read',
            '        steps:',
            '            - uses: gitleaks/gitleaks-action@bbb',
            '    third:',
            '        steps:',
            '            - uses: gitleaks/gitleaks-action@ccc'
        ].join('\n');
        const findings = check(twice);

        assert.equal(findings.length, 2);
        assert.match(findings[0], /job "first"/);
        assert.match(findings[1], /job "third"/);
    });

    // A job-level `permissions:` block replaces the workflow-level one, so the scope belongs on the
    // gitleaks job alone: a workflow-wide grant would also widen every other job's token.
    const pullRequestScopeOutsideJob = (text, jobId) => {
        const lines = text.split('\n');
        const own = lines.findIndex((line) => line === `    ${jobId}:`);
        const next = lines.findIndex((line, index) => index > own && /^ {4}\S/.test(line));
        const stop = next === -1 ? lines.length : next;

        return lines.flatMap((line, index) => {
            const inside = own !== -1 && index > own && index < stop;
            const grant = /^\s*(pull-requests:|permissions:\s*(read|write)-all\b)/.test(line);
            return grant && !inside ? [index + 1] : [];
        });
    };
    const securityFixture = (workflowLevel, otherJob) =>
        [
            'on:',
            '    pull_request:',
            workflowLevel,
            'jobs:',
            '    gitleaks:',
            '        permissions:',
            '            contents: read',
            '            pull-requests: read',
            '        steps:',
            '            - uses: gitleaks/gitleaks-action@aaa',
            '    codeql:',
            otherJob
        ].join('\n');

    it('finds a pull-requests grant outside the gitleaks job, and none inside it', () => {
        const clean = securityFixture('permissions:\n    contents: read', '        steps: []');
        const wide = securityFixture(
            'permissions:\n    contents: read\n    pull-requests: read',
            '        steps: []'
        );
        const blanket = securityFixture('permissions: read-all', '        steps: []');
        const sibling = securityFixture(
            'permissions:\n    contents: read',
            '        permissions:\n            pull-requests: write'
        );

        assert.deepEqual(pullRequestScopeOutsideJob(clean, 'gitleaks'), []);
        assert.equal(pullRequestScopeOutsideJob(wide, 'gitleaks').length, 1);
        assert.equal(pullRequestScopeOutsideJob(blanket, 'gitleaks').length, 1);
        assert.equal(pullRequestScopeOutsideJob(sibling, 'gitleaks').length, 1);
        assert.notDeepEqual(pullRequestScopeOutsideJob(clean, 'missing'), []);
    });

    // The private-fork failure shows only on a fork's first pull request, so this repository's own
    // workflows are checked on every test run, not only when docs:check runs.
    describe("this repository's own workflows", () => {
        const dir = path.join(process.cwd(), '.github/workflows');
        const files = existsSync(dir)
            ? readdirSync(dir).filter((file) => file.endsWith('.yml'))
            : [];

        it('grant pull-requests: read to every gitleaks job on a pull_request trigger', () => {
            const workflows = files.map((file) => [
                `.github/workflows/${file}`,
                readFileSync(path.join(dir, file), 'utf8')
            ]);

            assert.deepEqual(checkPullRequestReadPermission({ workflows }), []);
        });

        it('keep the pull-requests scope on the security workflow gitleaks job only', () => {
            assert.ok(files.includes('security.yml'));
            assert.deepEqual(
                pullRequestScopeOutsideJob(
                    readFileSync(path.join(dir, 'security.yml'), 'utf8'),
                    'gitleaks'
                ),
                []
            );
        });
    });
});

describe('deriveWorkflowContexts', () => {
    it('derives a matrix job context from its id and a named job context with no matrix', () => {
        const workflow = [
            'name: CI',
            'jobs:',
            '    validate:',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                node-version: [24.x]',
            '        steps:',
            '            - run: npm ci',
            '    gitleaks:',
            '        name: Secret scan (gitleaks)',
            '        runs-on: ubuntu-latest'
        ].join('\n');
        assert.deepEqual(deriveWorkflowContexts(workflow).contexts, [
            'validate (24.x)',
            'Secret scan (gitleaks)'
        ]);
    });

    it('returns nothing for a workflow with no jobs: key', () => {
        assert.deepEqual(deriveWorkflowContexts('name: CI\non:\n    push:\n'), {
            contexts: [],
            undecidable: []
        });
    });

    // A matrix written as a block list, not inline, must derive the same contexts: both shapes
    // are valid workflow syntax.
    it('gives identical contexts for an inline matrix and the equivalent block-list matrix', () => {
        const inlineMatrix = [
            'name: CI',
            'jobs:',
            '    validate:',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                node-version: [24.x, 22.x]',
            '        steps:',
            '            - run: npm ci'
        ].join('\n');
        const blockMatrix = [
            'name: CI',
            'jobs:',
            '    validate:',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                node-version:',
            '                    - 24.x',
            '                    - 22.x',
            '        steps:',
            '            - run: npm ci'
        ].join('\n');
        assert.deepEqual(deriveWorkflowContexts(inlineMatrix).contexts, [
            'validate (24.x)',
            'validate (22.x)'
        ]);
        assert.deepEqual(
            deriveWorkflowContexts(blockMatrix).contexts,
            deriveWorkflowContexts(inlineMatrix).contexts
        );
    });

    // An `include:`/`exclude:` matrix renders its real combination set only at runtime, so the
    // job is undecidable rather than silently wrong.
    it('marks a job with an include/exclude matrix as undecidable, naming its static base', () => {
        const workflow = [
            'name: CI',
            'jobs:',
            '    build:',
            '        name: Build',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                os: [ubuntu-latest]',
            '                include:',
            '                    - os: ubuntu-latest',
            '                      extra: true',
            '        steps:',
            '            - run: npm run build'
        ].join('\n');
        const result = deriveWorkflowContexts(workflow);
        assert.deepEqual(result.contexts, []);
        assert.deepEqual(result.undecidable, [
            { line: 3, id: 'build', base: 'Build', reason: 'matrix include/exclude' }
        ]);
    });

    // A job name that interpolates a matrix value is rendered only at runtime too.
    it('marks a job whose name: carries an expression as undecidable, keeping the static prefix', () => {
        const workflow = [
            'name: CI',
            'jobs:',
            '    build:',
            '        name: Build (${{ matrix.os }})',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                os: [ubuntu-latest]',
            '        steps:',
            '            - run: npm run build'
        ].join('\n');
        const result = deriveWorkflowContexts(workflow);
        assert.deepEqual(result.contexts, []);
        assert.deepEqual(result.undecidable, [
            { line: 3, id: 'build', base: 'Build (', reason: 'job name uses an expression' }
        ]);
    });
});

describe('checkRulesetContexts', () => {
    const workflow = [
        'name: CI',
        'jobs:',
        '    cross-browser:',
        '        runs-on: ubuntu-latest',
        '        steps:',
        '            - run: npm run build'
    ].join('\n');
    const ruleset = (context) =>
        JSON.stringify(
            {
                rules: [
                    {
                        type: 'required_status_checks',
                        parameters: { required_status_checks: [{ context }] }
                    }
                ]
            },
            null,
            4
        );

    it('passes when the ruleset context matches a workflow job', () => {
        const result = checkRulesetContexts({
            rulesetText: ruleset('cross-browser'),
            workflows: [['.github/workflows/ci.yml', workflow]]
        });
        assert.deepEqual(result.findings, []);
        assert.deepEqual(result.notes, []);
    });

    // An ordinary renamed job must still fail: the exemption for undecidable jobs is scoped to
    // those jobs only, never a blanket loosening.
    it('fails when the job behind a required context is renamed', () => {
        const renamed = workflow.replace('cross-browser:', 'cross-browser-v2:');
        const result = checkRulesetContexts({
            rulesetText: ruleset('cross-browser'),
            workflows: [['.github/workflows/ci.yml', renamed]]
        });
        assert.equal(result.findings.length, 1);
        assert.ok(
            result.findings[0].includes(
                'required context "cross-browser" is produced by no workflow job'
            )
        );
    });

    it('accepts a context produced by an external app via the allowlist', () => {
        const result = checkRulesetContexts({
            rulesetText: ruleset('license/cla'),
            workflows: [['.github/workflows/ci.yml', workflow]],
            allowlist: [{ context: 'license/cla', reason: 'external app, not our workflow' }]
        });
        assert.deepEqual(result.findings, []);
    });

    it('returns no findings when the repo carries no ruleset file', () => {
        assert.deepEqual(checkRulesetContexts({ rulesetText: null, workflows: [] }), {
            findings: [],
            notes: []
        });
    });
});

// A job GitHub can only resolve at runtime (include/exclude, an expression name) must never
// cause a false red, and must say so once, loudly, without failing the check.
describe('checkRulesetContexts: jobs that cannot be derived statically', () => {
    const includeMatrixWorkflow = [
        'name: CI',
        'jobs:',
        '    build:',
        '        name: Build',
        '        runs-on: ubuntu-latest',
        '        strategy:',
        '            matrix:',
        '                os: [ubuntu-latest]',
        '                include:',
        '                    - os: ubuntu-latest',
        '                      extra: true',
        '        steps:',
        '            - run: npm run build'
    ].join('\n');
    const ruleset = (context) =>
        JSON.stringify(
            {
                rules: [
                    {
                        type: 'required_status_checks',
                        parameters: { required_status_checks: [{ context }] }
                    }
                ]
            },
            null,
            4
        );

    it('skips the strict comparison and prints the loud non-failing line for an include/exclude matrix', () => {
        const result = checkRulesetContexts({
            rulesetText: ruleset('Build (ubuntu-latest)'),
            workflows: [['.github/workflows/ci.yml', includeMatrixWorkflow]]
        });
        assert.deepEqual(result.findings, []);
        assert.deepEqual(result.notes, [
            'docs:check: cannot derive the status-check names of .github/workflows/ci.yml:3 job build (matrix include/exclude) — ruleset contexts for it are not verified'
        ]);
    });

    it('still flags a context unrelated to the undecidable job', () => {
        const result = checkRulesetContexts({
            rulesetText: ruleset('Secret scan (gitleaks)'),
            workflows: [['.github/workflows/ci.yml', includeMatrixWorkflow]]
        });
        assert.equal(result.findings.length, 1);
        assert.ok(result.findings[0].includes('required context "Secret scan (gitleaks)"'));
    });

    it('marks a job whose name: carries an expression as undecidable too', () => {
        const workflow = [
            'name: CI',
            'jobs:',
            '    build:',
            '        name: Build (${{ matrix.os }})',
            '        runs-on: ubuntu-latest',
            '        strategy:',
            '            matrix:',
            '                os: [ubuntu-latest]',
            '        steps:',
            '            - run: npm run build'
        ].join('\n');
        const result = checkRulesetContexts({
            rulesetText: ruleset('Build (ubuntu-latest)'),
            workflows: [['.github/workflows/ci.yml', workflow]]
        });
        assert.deepEqual(result.findings, []);
        assert.ok(result.notes[0].includes('job name uses an expression'));
    });
});

describe('checkSuiteBudgets', () => {
    const root = process.cwd();
    const suite = { dir: 'scripts', match: '\\.test\\.mjs$', count: 'files' };
    /* The fixture derives the count from this repo's own script suites: a hand-written number would go
       stale the next time a script test is added. */
    const overCeiling = checkSuiteBudgets({ root, suites: { unit: { ...suite, max: 0 } } })[0];
    const count = Number(/: (\d+) file/.exec(overCeiling)?.[1] ?? 0);
    it('passes a suite inside its ceiling', () => {
        assert.ok(count > 0);
        assert.deepEqual(
            checkSuiteBudgets({ root, suites: { unit: { ...suite, max: count + 1 } } }),
            []
        );
    });
    it('reports a suite over the ceiling and names the remedy', () => {
        const findings = checkSuiteBudgets({ root, suites: { unit: { ...suite, max: 1 } } });
        assert.equal(findings.length, 1);
        assert.ok(findings[0].includes('over the ceiling of 1'));
        assert.ok(findings[0].includes('DECISIONS.md'));
    });
    it('reports a ceiling more than twice the measurement, and a missing directory', () => {
        const generous = checkSuiteBudgets({ root, suites: { unit: { ...suite, max: 500 } } });
        assert.ok(generous[0].includes('flags nothing'));
        const missing = checkSuiteBudgets({
            root,
            suites: { gone: { dir: 'nowhere', match: '.', count: 'files', max: 1 } }
        });
        assert.ok(missing[0].includes('does not exist'));
    });
    it('ignores the _description key and counts test calls when asked', () => {
        const findings = checkSuiteBudgets({
            root,
            suites: {
                _description: 'not a suite',
                calls: { dir: 'scripts', match: 'docs-check\\.test\\.mjs$', count: 'tests', max: 0 }
            }
        });
        assert.equal(findings.length, 1);
        assert.ok(findings[0].includes('test(s)'));
    });
});

describe('checkMemoryImports', () => {
    /** Scans a temp repo: `text` is the whole CLAUDE.md or AGENTS.md, `files` are the real files. */
    const scan = (text, { file = 'AGENTS.md', files = ['x.md'] } = {}) => {
        const root = mkdtempSync(path.join(tmpdir(), 'memory-imports-'));
        try {
            for (const name of ['AGENTS.md', ...files]) {
                mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
                writeFileSync(path.join(root, name), '');
            }
            writeFileSync(path.join(root, file), text);
            return checkMemoryImports(root);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    };

    // [text, the flagged target or null for clean, options: file, files, line]
    const cases = [
        ['Detail: @x.md', 'x.md'],
        ['**@x.md**', 'x.md'],
        ['**see @x.md**', 'x.md'],
        ['[@x.md](u)', 'x.md'],
        ['[see @x.md](u)', 'x.md'],
        ['_@x.md_', 'x.md'],
        ['~~@x.md~~', 'x.md'],
        ['>@x.md', 'x.md'],
        ['**bold**@x.md', 'x.md'],
        ['<b>x</b>@x.md', 'x.md'],
        ['- item @x.md', 'x.md'],
        ['- read `@x.md`', 'x.md'],
        ['@~/notes.md', '~/notes.md'],
        ['see @./x.md#part.', './x.md'],
        ['# Doc\n```\n@x.md\n```\nDetail: @x.md', 'x.md', { line: 5 }],
        ['`x.md`', null],
        ['```md\nDetail: @x.md\n```', null],
        ['~~~\n@x.md\n~~~', null],
        ['me@example.com', null],
        ['built on @testing-library/react-native and @scope/pkg', null],
        ['the `@/*` alias and @/i18n/request-locale', null],
        ['typescript-eslint@8.65.0', null],
        ['the `@`-imported file', null],
        ['@x.md', null, { files: [] }],
        ['@sub', null, { files: ['sub/y.md'] }],
        ['@AGENTS.md', null, { file: 'CLAUDE.md' }],
        ['@AGENTS.md', 'AGENTS.md']
    ];

    for (const [text, target, options] of cases) {
        it(JSON.stringify(text), () => {
            const findings = scan(text, options);
            if (target === null) assert.deepEqual(findings, []);
            else
                assert.deepEqual(findings, [
                    `AGENTS.md:${options?.line ?? 1}: "@${target}" is a Claude Code memory import; write the pointer as a path in backticks without "@"`
                ]);
        });
    }
});
