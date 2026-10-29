import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isEntryPoint } from './is-entry-point.mjs';

// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('isEntryPoint', () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) {
            rmSync(root, { recursive: true, force: true });
        }
    });

    /* A real file, in a directory whose name the case chooses. Node gives a module the URL of its
       REAL path, so that is what `import.meta.url` is here. */
    const makeScript = (directory = 'plain') => {
        const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'entry-point-')));
        roots.push(root);
        const file = path.join(root, directory, 'script.mjs');
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, '');
        return { root, file, url: pathToFileURL(file).href };
    };

    it('is true when node was started on the module itself', () => {
        const { file, url } = makeScript();

        assert.equal(isEntryPoint(url, file), true);
    });

    for (const directory of ['has#hash', 'has%percent', 'has?question', 'has space', 'a#b%c?d e']) {
        it(`is true when the path has ${directory} in it, which a hand-built file:// URL cannot spell`, () => {
            const { file, url } = makeScript(directory);

            assert.equal(isEntryPoint(url, file), true);
        });
    }

    it('is true when node was started through a symlink to the module', () => {
        const { root, file, url } = makeScript();
        const link = path.join(root, 'link.mjs');
        symlinkSync(file, link);

        assert.equal(isEntryPoint(url, link), true);
    });

    it('is true when node was started through a symlinked directory', () => {
        const { root, file, url } = makeScript('real');
        symlinkSync(path.dirname(file), path.join(root, 'linked'));

        assert.equal(isEntryPoint(url, path.join(root, 'linked', 'script.mjs')), true);
    });

    it('is true when node keeps the symlink in the module URL (--preserve-symlinks-main)', () => {
        const { root, file } = makeScript();
        const link = path.join(root, 'link.mjs');
        symlinkSync(file, link);

        assert.equal(isEntryPoint(pathToFileURL(link).href, link), true);
    });

    it('is false for a module that was only imported: node was started on another file', () => {
        const entry = makeScript('entry');
        const imported = makeScript('imported');

        assert.equal(isEntryPoint(imported.url, entry.file), false);
    });

    it('is false for a different file that shares the directory and a name prefix', () => {
        const { root, file } = makeScript();
        const sibling = path.join(root, 'plain', 'script.mjs.bak');
        writeFileSync(sibling, '');

        assert.equal(isEntryPoint(pathToFileURL(sibling).href, file), false);
    });

    for (const entry of [undefined, '']) {
        it(`is false when there is no entry file (${JSON.stringify(entry)}): -e, a REPL`, () => {
            const { url } = makeScript();

            assert.equal(isEntryPoint(url, entry), false);
        });
    }

    it('is false, and does not throw, when the entry path does not exist', () => {
        const { root, url } = makeScript();

        assert.equal(isEntryPoint(url, path.join(root, 'gone', 'script.mjs')), false);
    });

    /* `node --test` runs each test file as `node <file>`, so the real `process.argv[1]` here is this
       very file: the case sets it to a script of its own instead of relying on the runner. */
    it('reads process.argv[1] when no entry is given', () => {
        const entry = makeScript('entry');
        const other = makeScript('other');
        const original = process.argv[1];
        process.argv[1] = entry.file;
        try {
            assert.equal(isEntryPoint(entry.url), true);
            assert.equal(isEntryPoint(other.url), false);
        } finally {
            process.argv[1] = original;
        }
    });
});

/* A hand-written guard (`import.meta.url === new URL('file://' + process.argv[1]).href`) was copied
   into every script, and it does nothing, with exit code 0, whenever the path has a `#`, `%` or `?` in
   it or goes through a symlink. For a gate check that is a pass that checked nothing. These cases keep
   the class closed: a script asks the helper, and a new script cannot bring the old guard back. */
describe('the scripts', () => {
    const scripts = readdirSync(HERE)
        .filter((name) => /\.m?js$/.test(name) && !name.includes('.test.'))
        .filter((name) => name !== 'is-entry-point.mjs')
        .map((name) => [name, readFileSync(path.join(HERE, name), 'utf8')]);

    it('never decide by hand whether they are the entry point', () => {
        const byHand = scripts
            .filter(([, source]) => /argv\[1\]|argv\.at\(1\)/.test(source))
            .map(([name]) => name);

        assert.deepEqual(byHand, []);
    });

    it('ask the helper in one shape, and import it', () => {
        const asking = scripts.filter(([, source]) => source.includes('isEntryPoint'));

        assert.ok(asking.length > 0, 'no script asks the helper');
        for (const [name, source] of asking) {
            assert.ok(
                source.includes("import { isEntryPoint } from './is-entry-point.mjs';"),
                `${name} does not import the helper in the shared shape`
            );
            assert.ok(
                source.includes('if (isEntryPoint(import.meta.url)) {'),
                `${name} does not guard main() in the shared shape`
            );
        }
    });
});
