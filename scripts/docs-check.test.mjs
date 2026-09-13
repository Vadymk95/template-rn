// Runner: `node:test`, not Jest — see gate-trace.test.mjs. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    budgetReport,
    checkCommandTable,
    checkDeadDocs,
    checkQuarantine,
    checkPathsAndScripts,
    checkRevisitDates,
    checkSuiteBudgets,
    checkSentinels,
    checkVersions,
    classifyToken,
    compareVersion,
    extractTokens,
    listTestFiles,
    parseTraceRows,
    pathExists,
    percentile90,
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

describe('checkRevisitDates', () => {
    it('flags only revisit lines whose latest date is past', () => {
        const docs = [
            [
                'x.md',
                'Revisit trigger 2026-08-23; missed, re-armed 2026-10-28\nrevisit 2026-01-01\nplain date 2026-01-01'
            ]
        ];
        const findings = checkRevisitDates({ docs, today: '2026-09-12' });
        assert.deepEqual(findings, [
            'x.md:2: revisit/trigger dated 2026-01-01 is in the past — act on it or re-date it'
        ]);
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
                "test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');"
            ],
            [
                'e.spec.ts',
                "test.skip(\n    ({ baseURL }) => !baseURL?.includes(':4173'),\n    'preview only'\n);"
            ],
            [
                'f.test.ts',
                "// quarantine until 2099-01-01: the fixture is rewritten in the next slice\nit.skip('x', () => {});"
            ]
        ];
        assert.deepEqual(checkQuarantine({ tests, today }), []);
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
