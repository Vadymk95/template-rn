// What Tailwind scans for class names, against the real Tailwind and the real `content` array of
// tailwind.config.js. NativeWind styles come from the utilities Tailwind finds in those files, so a
// stray class name in a test file, a test helper or a comment would put a rule into the compiled CSS
// that no product screen uses, and a screen folder the globs miss would lose its styles with no
// error (the tests do not render compiled CSS).
//
// The `content` array is copied as written into a throwaway tree that holds product files, test
// files and test helpers, each with a utility of its own, and Tailwind's own CLI compiles it: its
// bin is run, because `postcss` is not a dependency of this repository. The patterns are relative, so
// the compile runs with that tree as the working directory. Only the product utilities may appear.
//
// Runner: `node:test`, not Jest (Jest 29 does not discover `.mjs` gate scripts). Run via
// `npm run test:scripts`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const nodeRequire = createRequire(import.meta.url);

// One arbitrary width per file, so a CSS rule names the file that put it there.
const FILES = {
    scanned: {
        'src/ok.tsx': 111,
        'src/features/tasks/List.tsx': 222,
        'src/features/test/Real.tsx': 333,
        'src/shared/lib/attest.ts': 444
    },
    left: {
        'src/x.test.tsx': 555,
        'src/features/tasks/List.test.ts': 666,
        'src/test/helper.ts': 777,
        'src/test/app/screen.test.tsx': 888
    }
};

const tailwindBin = () => {
    const manifest = nodeRequire.resolve('tailwindcss/package.json');

    return path.join(path.dirname(manifest), nodeRequire(manifest).bin.tailwindcss);
};

describe('what the Tailwind content globs scan', { timeout: 60_000 }, () => {
    let root;
    let css;

    before(() => {
        const { content } = nodeRequire('../tailwind.config.js');
        root = realpathSync(mkdtempSync(path.join(tmpdir(), 'tailwind-scan-')));
        for (const [file, width] of Object.entries({ ...FILES.scanned, ...FILES.left })) {
            mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
            writeFileSync(
                path.join(root, file),
                `export const style = 'w-[${String(width)}px]';\n`
            );
        }
        writeFileSync(
            path.join(root, 'tailwind.config.js'),
            `module.exports = { content: ${JSON.stringify(content)} };\n`
        );
        writeFileSync(path.join(root, 'input.css'), '@tailwind utilities;\n');

        css = execFileSync(
            process.execPath,
            [tailwindBin(), '-c', 'tailwind.config.js', '-i', 'input.css'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
    });

    after(() => {
        rmSync(root, { recursive: true, force: true });
    });

    const compiled = (width) => new RegExp(`width:\\s*${String(width)}px`).test(css);

    for (const [file, width] of Object.entries(FILES.scanned)) {
        it(`scans the product file ${file}`, () => {
            assert.equal(compiled(width), true, `w-[${String(width)}px] from ${file} is missing`);
        });
    }

    for (const [file, width] of Object.entries(FILES.left)) {
        it(`leaves the test file ${file} alone`, () => {
            assert.equal(compiled(width), false, `w-[${String(width)}px] from ${file} is compiled`);
        });
    }
});
