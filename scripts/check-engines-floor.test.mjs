// Runner-agnostic on purpose: the templates run their script tests under different runners (vitest
// with globals, or `node --test`). Unlike check-version-holds.test.mjs this file is NOT shared:
// each template implements the check its own way (different exports, different packages counted),
// so the copies differ.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseRange } from './check-version-holds.mjs';
import { checkEnginesFloor, floorWithinMajor, run } from './check-engines-floor.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

// Resolved from the repo root, not from `import.meta.url`: vitest serves this module over its own
// URL scheme, so a URL-relative path cannot work there; `node --test` runs from the root as well.
const SCRIPT = path.resolve(process.cwd(), 'scripts/check-engines-floor.mjs');

/* ------------------------------------------------------------------------ fixtures */

/** The case that motivated the check: the manifest said >=24.0.0 while a locked package needed 24.15. */
const STRICT_ENGINES = '^22.22.2 || ^24.15.0 || >=26.0.0';

const lockWith = (packages = {}) => ({
    lockfileVersion: 3,
    packages: { '': { engines: { node: '>=24.0.0' } }, ...packages }
});

const pkg = (spec, extra = {}) => ({ version: '1.0.0', engines: { node: spec }, ...extra });

const check = ({ declared = '>=24.15.0', packages = {}, nvmrc = '24.15' } = {}) =>
    checkEnginesFloor({
        manifest: { engines: { node: declared } },
        lock: lockWith(packages),
        nvmrc
    });

const floorOf = (spec, major) => floorWithinMajor(parseRange(spec), major);

/* ------------------------------------------------------------------------ floorWithinMajor */

describe('floorWithinMajor', () => {
    it('takes the lowest version of the major that the range admits', () => {
        assert.deepEqual(floorOf(STRICT_ENGINES, 24), [24, 15, 0]);
        assert.deepEqual(floorOf('^22.18.0 || >=24.11.0', 24), [24, 11, 0]);
        assert.deepEqual(floorOf('>=24.11.0 <25', 24), [24, 11, 0]);
    });

    it('is the start of the major when the range admits all of it', () => {
        assert.deepEqual(floorOf('>=20', 24), [24, 0, 0]);
        assert.deepEqual(floorOf('^20.19.0 || >=22.12.0', 24), [24, 0, 0]);
        assert.deepEqual(floorOf('*', 24), [24, 0, 0]);
    });

    it('is null when the range admits nothing of the major', () => {
        assert.equal(floorOf('^22.0.0', 24), null);
        assert.equal(floorOf('>=25', 24), null);
    });
});

/* ------------------------------------------------------------------------ checkEnginesFloor */

describe('checkEnginesFloor', () => {
    it('passes when the declared floor and .nvmrc are at the strictest locked floor', () => {
        const result = check({
            declared: '>=24.15.0',
            nvmrc: '24.15',
            packages: {
                'node_modules/a': pkg(STRICT_ENGINES),
                'node_modules/b': pkg('>=18')
            }
        });

        assert.deepEqual(result.findings, []);
        assert.deepEqual(result.floor, [24, 15, 0]);
        assert.equal(result.owner, 'node_modules/a');
    });

    it('fails when engines.node is below a locked package floor, naming the package and the fix', () => {
        const { findings } = check({
            declared: '>=24.0.0',
            nvmrc: '24.15',
            packages: { 'node_modules/@asamuzakjp/css-color': pkg(STRICT_ENGINES) }
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /engines\.node ">=24\.0\.0"/);
        assert.match(findings[0], /node_modules\/@asamuzakjp\/css-color/);
        assert.match(findings[0], /\^22\.22\.2 \|\| \^24\.15\.0 \|\| >=26\.0\.0/);
        assert.match(findings[0], /24\.15\.0/);
        assert.match(findings[0], /">=24\.15\.0"/);
    });

    it('reports the strictest of several packages, nested ones included', () => {
        const { findings, owner, floor } = check({
            declared: '>=24.0.0',
            nvmrc: '24.15',
            packages: {
                'node_modules/a': pkg('^22.18.0 || >=24.11.0'),
                'node_modules/b/node_modules/c': pkg(STRICT_ENGINES),
                'node_modules/d': pkg('>=20')
            }
        });

        assert.equal(findings.length, 1);
        assert.deepEqual(floor, [24, 15, 0]);
        assert.equal(owner, 'node_modules/b/node_modules/c');
        assert.match(findings[0], /node_modules\/b\/node_modules\/c/);
    });

    it('stays quiet while a floor above the strictest locked one is declared', () => {
        const { findings } = check({
            declared: '>=24.16.0',
            nvmrc: '24.16',
            packages: { 'node_modules/a': pkg(STRICT_ENGINES) }
        });

        assert.deepEqual(findings, []);
    });

    it('reads the major from the declared floor', () => {
        const { findings, floor } = check({
            declared: '>=22.0.0',
            nvmrc: '22',
            packages: { 'node_modules/a': pkg('^20.19.0 || ^22.12.0 || >=24') }
        });

        assert.deepEqual(floor, [22, 12, 0]);
        assert.equal(findings.length, 2);
        assert.match(findings[0], /22\.12\.0/);
    });

    it('does not count the root entry or an optional package', () => {
        const { findings, floor } = check({
            declared: '>=24.0.0',
            nvmrc: '24',
            packages: {
                'node_modules/fsevents': pkg('>=24.99.0', { optional: true }),
                'node_modules/a': pkg('>=18')
            }
        });

        assert.deepEqual(findings, []);
        assert.deepEqual(floor, [24, 0, 0]);
    });

    it('fails a package that admits no Node of the declared major', () => {
        const { findings } = check({
            declared: '>=24.0.0',
            nvmrc: '24',
            packages: { 'node_modules/old': pkg('^22.0.0') }
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /node_modules\/old/);
        assert.match(findings[0], /no Node 24\.x/);
    });

    it('fails an .nvmrc that resolves below the floor, and accepts a v prefix', () => {
        const packages = { 'node_modules/a': pkg(STRICT_ENGINES) };

        const low = check({ declared: '>=24.15.0', nvmrc: '24', packages });
        assert.equal(low.findings.length, 1);
        assert.match(low.findings[0], /\.nvmrc "24"/);
        assert.match(low.findings[0], /24\.15\.0/);

        assert.deepEqual(
            check({ declared: '>=24.15.0', nvmrc: 'v24.15.2\n', packages }).findings,
            []
        );
    });

    it('holds .nvmrc to the declared floor even when the lock needs less', () => {
        const { findings } = check({ declared: '>=24.16.0', nvmrc: '24.11', packages: {} });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /\.nvmrc "24\.11"/);
        assert.match(findings[0], /24\.16\.0/);
    });

    it('skips .nvmrc when there is none, and says so for a value it cannot read', () => {
        const none = check({ nvmrc: null, packages: {} });
        assert.deepEqual(none.findings, []);

        const alias = check({ nvmrc: 'lts/*', packages: {} });
        assert.deepEqual(alias.findings, []);
        assert.equal(alias.notes.length, 1);
        assert.match(alias.notes[0], /lts\/\*/);
    });

    it('notes a locked range it cannot read instead of guessing', () => {
        const { findings, notes } = check({
            packages: { 'node_modules/odd': pkg('1.2.3 - 2.3.4') }
        });

        assert.deepEqual(findings, []);
        assert.equal(notes.length, 1);
        assert.match(notes[0], /node_modules\/odd/);
    });

    it('refuses a declaration with no lower bound or no engines at all', () => {
        assert.match(check({ declared: '<25' }).findings[0], /lower bound/);
        assert.match(
            checkEnginesFloor({ manifest: {}, lock: lockWith(), nvmrc: '24' }).findings[0],
            /engines\.node/
        );
    });
});

/* ------------------------------------------------------------------------ run + CLI */

const writeRoot = ({ declared, nvmrc, packages }) => {
    const root = mkdtempSync(path.join(tmpdir(), 'engines-floor-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ engines: { node: declared } }));
    writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lockWith(packages)));
    if (nvmrc !== null) writeFileSync(path.join(root, '.nvmrc'), `${nvmrc}\n`);
    return root;
};

describe('run and the command line', () => {
    it('reads package.json, package-lock.json and .nvmrc from the root', () => {
        const root = writeRoot({
            declared: '>=24.0.0',
            nvmrc: '24',
            packages: { 'node_modules/a': pkg(STRICT_ENGINES) }
        });
        try {
            assert.equal(run({ root }).findings.length, 2);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('exits 1 on a finding and 0 when the floor is declared', () => {
        const packages = { 'node_modules/a': pkg(STRICT_ENGINES) };
        const bad = writeRoot({ declared: '>=24.0.0', nvmrc: '24', packages });
        const good = writeRoot({ declared: '>=24.15.0', nvmrc: '24.15', packages });
        try {
            const red = spawnSync('node', [SCRIPT, '--root', bad], { encoding: 'utf8' });
            assert.equal(red.status, 1);
            assert.match(red.stdout, /✖/);

            const green = spawnSync('node', [SCRIPT, '--root', good], { encoding: 'utf8' });
            assert.equal(green.status, 0);
            assert.match(green.stdout, /24\.15\.0/);
        } finally {
            rmSync(bad, { recursive: true, force: true });
            rmSync(good, { recursive: true, force: true });
        }
    });

    it('fails loudly when a file it needs is missing', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'engines-floor-'));
        try {
            const result = spawnSync('node', [SCRIPT, '--root', root], { encoding: 'utf8' });
            assert.equal(result.status, 1);
            assert.match(result.stdout, /cannot be read/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
