// Guards the native config against plain-HTTP network access by reading SOURCE TEXT. Both platforms
// block cleartext HTTP unless the app opts out, and `app.config.ts` is where this template can opt out.
//
// Scanned: `app.config.ts` and the files directly under a local `plugins/` directory, if there is one
// (subdirectories are not scanned). Nothing is evaluated, parsed or followed, so a value gated on an env var
// or set inside a function plugin sits in the text like any other. A finding is every line that still names
// one of the four keys below after each plain `<key>: false` (followed by `,`, `}`, a `//` comment or the
// end of the line) is removed, so `false || IS_DEV` and a conditional spread are findings. A mention in a
// comment counts too: reword the comment, or add an allowance.
//
// `scripts/native-config-allowlist.json` is an array of { key, reason }; an allowance covers its key in
// every scanned file. Same fail-closed shape as `scripts/audit-gate.mjs`: a file that is not an array, an
// entry with an unknown key or a blank reason, and a stale entry (a key with no finding) all fail.
//
// Out of scope, stated rather than hidden: deliberate obfuscation (unicode escapes, a key built from
// strings, tricks with comments or escaped quotes), a file outside the two places above (a subdirectory of
// `plugins/`, an import from elsewhere, `node_modules`), and a static `app.json` (this template has none).
//
// Runner: `node:test`, not Jest, same reason as the other gate specs here. Run via `npm run test:scripts`.
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
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const ALLOWLIST = 'scripts/native-config-allowlist.json';

// Android `android:usesCleartextTraffic`, and the iOS App Transport Security switches (top level and
// per domain).
const KEYS = [
    'usesCleartextTraffic',
    'NSAllowsArbitraryLoads',
    'NSExceptionAllowsInsecureHTTPLoads',
    'NSTemporaryExceptionAllowsInsecureHTTPLoads'
];

/** The files to scan, as { path: text }: the config, plus each file directly under `plugins/`. */
const readSources = (root) => {
    const plugins = join(root, 'plugins');
    const paths = [
        'app.config.ts',
        ...(existsSync(plugins)
            ? readdirSync(plugins, { withFileTypes: true })
                  .filter((entry) => entry.isFile())
                  .map(({ name }) => `plugins/${name}`)
            : [])
    ];

    return Object.fromEntries(paths.map((path) => [path, readFileSync(join(root, path), 'utf8')]));
};

/** Every line that still names a cleartext key once each plain `<key>: false` is removed, as { key, path, line }. */
const findCleartext = (path, text) =>
    text
        .split('\n')
        .flatMap((line, index) =>
            KEYS.filter((key) =>
                line
                    .replace(new RegExp(`${key}\\s*:\\s*false(?=\\s*(?:[,}]|//|$))`, 'g'), '')
                    .includes(key)
            ).map((key) => ({ key, path, line: index + 1 }))
        );

const isValidEntry = (entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    KEYS.includes(entry.key) &&
    typeof entry.reason === 'string' &&
    entry.reason.trim() !== '';

/** Every reason the scan fails, as a message; an empty array is a pass. */
const check = (sources, allowlist) => {
    if (!Array.isArray(allowlist)) {
        return [`${ALLOWLIST} must be an array of { "key", "reason" } entries ([] allows nothing)`];
    }

    const allowed = new Set(allowlist.filter(isValidEntry).map(({ key }) => key));
    const findings = Object.entries(sources).flatMap(([path, text]) => findCleartext(path, text));
    const found = new Set(findings.map(({ key }) => key));

    return [
        ...allowlist
            .filter((entry) => !isValidEntry(entry))
            .map(
                (entry) =>
                    `malformed allowlist entry ${JSON.stringify(entry)}: needs one of ${KEYS.join(', ')} as "key" and a non-blank "reason"`
            ),
        ...findings
            .filter(({ key }) => !allowed.has(key))
            .map(
                ({ key, path, line }) =>
                    `${key} at ${path}:${line} can enable cleartext HTTP; remove it, or add { "key", "reason" } to ${ALLOWLIST}`
            ),
        ...[...allowed]
            .filter((key) => !found.has(key))
            .map((key) => `allowlist entry ${key} matches no finding; delete the entry`)
    ];
};

const config = (text) => ({ 'app.config.ts': text });

describe('cleartext key scan', () => {
    it('flags a literal true, an env-gated value, a conditional spread and a function plugin', () => {
        const forms = [
            'android: { usesCleartextTraffic: true }',
            `android: { usesCleartextTraffic: process.env.ALLOW_HTTP === '1' }`,
            'android: { usesCleartextTraffic: false || IS_DEV }',
            '...(IS_DEV ? { usesCleartextTraffic: true } : { usesCleartextTraffic: false })',
            'plugins: [(c) => {\n        c.android = { usesCleartextTraffic: true };\n        return c;\n    }]'
        ];

        for (const form of forms) {
            const failures = check(config(`export default {\n    ${form}\n};`), []);

            assert.equal(failures.length, 1, form);
            assert.match(failures[0], /^usesCleartextTraffic at app\.config\.ts:[23] /, form);
        }
    });

    it('flags each of the four keys when true and passes it when `: false`', () => {
        for (const key of KEYS) {
            const flagged = check(config(`{ ${key}: true }`), []);

            assert.equal(flagged.length, 1, key);
            assert.match(flagged[0], new RegExp(`^${key} at app\\.config\\.ts:1 `));
            assert.deepEqual(check(config(`{ ${key}: false }`), []), [], key);
            assert.deepEqual(check(config(`{ ${key} :  false, }`), []), [], key);
        }

        const sameLine = check(
            config('{ usesCleartextTraffic: false, NSAllowsArbitraryLoads: true }'),
            []
        );
        assert.equal(sameLine.length, 1);
        assert.match(sameLine[0], /^NSAllowsArbitraryLoads /);
    });

    it('counts a mention in a comment, which is accepted and documented', () => {
        const failures = check(config('// never set usesCleartextTraffic here'), []);

        assert.equal(failures.length, 1);
    });
});

describe('allowlist', () => {
    it('lets a valid allowance cover its key in every scanned file', () => {
        const sources = {
            'app.config.ts': '{ NSAllowsArbitraryLoads: true }',
            'plugins/ats.js': 'info.NSAllowsArbitraryLoads = true;'
        };
        const allowlist = [{ key: 'NSAllowsArbitraryLoads', reason: 'local dev server only' }];

        assert.equal(check(sources, []).length, 2);
        assert.deepEqual(check(sources, allowlist), []);
    });

    it('rejects an entry with a blank or missing reason', () => {
        for (const reason of ['', '   ', undefined, 42]) {
            const failures = check(config('export default {};'), [
                { key: 'usesCleartextTraffic', reason }
            ]);

            assert.equal(failures.length, 1, String(reason));
            assert.match(failures[0], /^malformed allowlist entry /);
        }
    });

    it('rejects an entry whose key is not one of the four, and an entry that is null', () => {
        for (const entry of [{ key: 'usesCleartextTrafic', reason: 'typo' }, null]) {
            const failures = check(config('export default {};'), [entry]);

            assert.equal(failures.length, 1, JSON.stringify(entry));
            assert.match(failures[0], /^malformed allowlist entry /, JSON.stringify(entry));
        }
    });

    it('rejects a stale entry: a key with no finding, or one that only occurs as `: false`', () => {
        const allowlist = [{ key: 'usesCleartextTraffic', reason: 'was needed once' }];

        for (const text of ['export default {};', '{ usesCleartextTraffic: false }']) {
            const failures = check(config(text), allowlist);

            assert.equal(failures.length, 1, text);
            assert.match(failures[0], /^allowlist entry usesCleartextTraffic matches no finding/);
        }
    });

    it('rejects a file that is not an array', () => {
        const entry = { key: 'usesCleartextTraffic', reason: 'r' };

        for (const allowlist of [{}, null, 'x', entry]) {
            const failures = check(config('export default {};'), allowlist);

            assert.equal(failures.length, 1, JSON.stringify(allowlist));
            assert.match(failures[0], /must be an array/);
        }
    });
});

describe('scanned files', () => {
    it('reads app.config.ts and every file directly under plugins/, and only those', () => {
        const root = mkdtempSync(join(tmpdir(), 'native-config-'));

        try {
            writeFileSync(join(root, 'app.config.ts'), 'export default {};');
            assert.deepEqual(Object.keys(readSources(root)), ['app.config.ts']);

            mkdirSync(join(root, 'plugins/nested'), { recursive: true });
            writeFileSync(join(root, 'plugins/http.js'), 'usesCleartextTraffic: true');
            writeFileSync(join(root, 'plugins/nested/deep.js'), 'x');
            const sources = readSources(root);

            assert.deepEqual(Object.keys(sources), ['app.config.ts', 'plugins/http.js']);
            assert.match(check(sources, [])[0], /^usesCleartextTraffic at plugins\/http\.js:1 /);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('finds nothing in the real app.config.ts and local plugins, under the real allowlist', () => {
        const allowlist = JSON.parse(readFileSync(join(ROOT, ALLOWLIST), 'utf8'));

        assert.deepEqual(check(readSources(ROOT), allowlist), []);
    });
});
