// Runner: `node:test`, not Jest — see gate-trace.test.mjs. Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    budgetReport,
    checkCommandTable,
    checkDeadDocs,
    checkPathsAndScripts,
    checkRevisitDates,
    checkSentinels,
    checkVersions,
    classifyToken,
    compareVersion,
    extractTokens,
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
    it('skips below three runs in the phase, warns above the budget or when the budget is twice the p90', () => {
        const row = (ms, phase = '0') => ({
            label: 'verify:push',
            durationMs: ms,
            exitCode: '0',
            phase
        });
        const report = (rows) =>
            budgetReport({ rows, label: 'verify:push', budgetSeconds: 60, phase: '0' }).kind;
        assert.equal(report([row(1000)]), 'skip');
        assert.equal(report([row(70000), row(75000), row(80000)]), 'warn');
        assert.equal(report([row(10000), row(11000), row(12000)]), 'warn');
        assert.equal(report([row(50000), row(55000), row(58000)]), 'ok');
        assert.equal(report([row(70000, 'full'), row(75000, 'full'), row(80000, 'full')]), 'skip');
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
