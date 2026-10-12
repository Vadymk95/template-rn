#!/usr/bin/env node
/**
 * engines-floor — the Node floor the manifest declares is a floor the lockfile can actually run on.
 *
 * Why it exists: `.npmrc` sets `engine-strict=true`, so `npm install` refuses a locked package whose
 * `engines.node` the running Node does not satisfy. A manifest that says `>=24.0.0` while one locked
 * dependency needs `^24.15.0` promises an install on 24.0 through 24.14 that npm then refuses, and the
 * promise is only broken on a fork's first install. The lockfile knows the real floor; this check
 * reads it, so the declared floor cannot drift below it when a dependency is bumped.
 *
 * What it reads: `engines.node` and `engines.npm` in package.json, every `engines.node` in
 * package-lock.json, `.nvmrc` and `.npmrc` when there are any.
 *
 * Findings (each printed on its own line; exit 1 when any exists):
 *   engines   the lowest version of the declared major that a locked package admits, taken over all
 *             packages, is above the lowest version `engines.node` admits. The strictest package is
 *             named, with the value to write.
 *   admits    a locked package admits no version of the declared major at all.
 *   nvmrc     `.nvmrc` resolves below the floor (the larger of the declared and the locked one): a
 *             contributor on the pinned version would be the first to hit the refusal.
 *   shape     package.json has no `engines.node`, or one with no lower bound.
 *   npm       `.npmrc` sets a key that only newer npm reads (NPM_KEY_FLOORS) and `engines.npm` admits an
 *             older one. An older npm warns "Unknown project config" and carries on without the key, so
 *             an install cooldown would silently not apply. With `engine-strict` a declared floor makes
 *             npm itself refuse the install on an older npm (measured on npm 11.6.1: EBADENGINE, exit
 *             1), so the leg only has to keep the declared floor at or above what `.npmrc` needs; the
 *             running npm is never compared here.
 *   lock root the lockfile's root entry (`packages[""].engines`) differs from `package.json`
 *             `engines`: npm rewrites it on the next install and leaves a dirty lockfile that
 *             `npm ci` never shows.
 *
 * Not counted towards the floor: the root entry of the lockfile (it is the manifest; the lock root
 * finding compares its engines with the manifest's instead), and `optional` packages (npm
 * installs them only where they fit and skips them where they do not, `engine-strict` included).
 * A locked range this file cannot read is printed as a note and never guessed. Only the declared
 * major is checked: a floor for a major the manifest does not declare would be a different promise.
 *
 * Ranges come from check-version-holds.mjs (comparators, `^`, `~`, x-ranges, `||`; hyphen ranges
 * throw), so both checks read a range the same way. No dependencies: it runs before anything is built.
 *
 * Usage: node scripts/check-engines-floor.mjs [--root <dir>]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseRange } from './check-version-holds.mjs';

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const show = (version) => version.join('.');

/**
 * `.npmrc` keys that only newer npm honours, with the first npm that does (npm CHANGELOG 11.10.0,
 * 2026-02-11: `min-release-age`). Node 24.14.1 is the first Node 24 release bundling an npm that
 * reads it (11.11.0; 24.14.0 bundles 11.9.0), which is why `.nvmrc` and engines.node sit there.
 */
const NPM_KEY_FLOORS = { 'min-release-age': [11, 10, 0] };

/** The keys `.npmrc` sets on a non-comment line, as `key=value` or `key = value`. */
const npmrcKeys = (text) =>
    text
        .split('\n')
        .map((line) => /^\s*([\w@/.:-]+)\s*=/.exec(line)?.[1])
        .filter((key) => typeof key === 'string' && !key.startsWith('#'));

/**
 * The lowest version of `major` that the range admits, or null when it admits none. Intervals are
 * [lo, hi) with null for unbounded, as parseRange returns them.
 */
export const floorWithinMajor = (intervals, major) => {
    const start = [major, 0, 0];
    const next = [major + 1, 0, 0];
    let floor = null;
    for (const { lo, hi } of intervals) {
        const candidate = lo !== null && compare(lo, start) > 0 ? lo : start;
        const below = (limit) => limit === null || compare(candidate, limit) < 0;
        if (below(hi) && below(next) && (floor === null || compare(candidate, floor) < 0)) {
            floor = candidate;
        }
    }
    return floor;
};

/** `.nvmrc` as a version triple: `24`, `24.15`, `v24.15.2`. Anything else (an alias) is null. */
const parseNvmrc = (text) => {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(text.trim());
    return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
};

/** The lowest version the declared range admits, or null when it has no lower bound. */
const declaredFloor = (intervals) => {
    const bounds = intervals.map((interval) => interval.lo);
    if (bounds.length === 0 || bounds.some((lo) => lo === null)) return null;
    return bounds.reduce((low, lo) => (compare(lo, low) < 0 ? lo : low));
};

/** The findings for engines.npm against the npm the `.npmrc` keys need. Quiet without `.npmrc`. */
const checkNpmFloor = ({ manifest, npmrc }) => {
    if (typeof npmrc !== 'string') return [];
    let needed = null;
    let key = null;
    for (const candidate of npmrcKeys(npmrc)) {
        const floor = NPM_KEY_FLOORS[candidate];
        if (floor && (needed === null || compare(floor, needed) > 0)) {
            needed = floor;
            key = candidate;
        }
    }
    if (needed === null) return [];

    const fix = `write engines.npm ">=${show(needed)}"`;
    const declared = manifest.engines?.npm;
    if (typeof declared !== 'string') {
        return [
            `.npmrc sets ${key}, which npm older than ${show(needed)} ignores with only a warning, and package.json has no engines.npm; ${fix}`
        ];
    }
    let low;
    try {
        low = declaredFloor(parseRange(declared));
    } catch (error) {
        return [`engines.npm "${declared}" cannot be read: ${error.message}`];
    }
    if (low === null) {
        return [`engines.npm "${declared}" has no lower bound, and .npmrc sets ${key}; ${fix}`];
    }
    if (compare(low, needed) < 0) {
        return [
            `engines.npm "${declared}" admits ${show(low)}, below ${show(needed)} that .npmrc ${key} needs (an older npm ignores the key and the install cooldown does not apply); ${fix}`
        ];
    }
    return [];
};

export const checkEnginesFloor = ({ manifest, lock, nvmrc, npmrc = null }) => {
    const findings = [];
    const notes = [];

    const declared = manifest?.engines?.node;
    if (typeof declared !== 'string') {
        return { findings: ['package.json has no engines.node'], notes, floor: null, owner: null };
    }
    let declaredIntervals;
    try {
        declaredIntervals = parseRange(declared);
    } catch (error) {
        return {
            findings: [`engines.node "${declared}" cannot be read: ${error.message}`],
            notes,
            floor: null,
            owner: null
        };
    }
    const declaredLow = declaredFloor(declaredIntervals);
    if (declaredLow === null) {
        return {
            findings: [
                `engines.node "${declared}" has no lower bound; write a floor such as ">=${show([24, 0, 0])}"`
            ],
            notes,
            floor: null,
            owner: null
        };
    }

    const major = declaredLow[0];
    let floor = [major, 0, 0];
    let owner = null;
    for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
        if (key === '' || entry.optional === true) continue;
        const spec = entry.engines?.node;
        if (typeof spec !== 'string') continue;
        let low;
        try {
            low = floorWithinMajor(parseRange(spec), major);
        } catch (error) {
            notes.push(`${key}: engines.node "${spec}" not read (${error.message})`);
            continue;
        }
        if (low === null) {
            findings.push(
                `${key} admits no Node ${String(major)}.x (engines.node "${spec}"), yet engine-strict refuses it on every Node ${String(major)}`
            );
        } else if (compare(low, floor) > 0) {
            floor = low;
            owner = key;
        }
    }

    if (compare(declaredLow, floor) < 0) {
        findings.push(
            `engines.node "${declared}" admits ${show(declaredLow)}, below ${show(floor)} that ${owner} needs (engines.node "${lock.packages[owner].engines.node}"); with engine-strict an install there is refused. Write engines.node ">=${show(floor)}"`
        );
    }

    if (typeof nvmrc === 'string') {
        const pinned = parseNvmrc(nvmrc);
        const required = compare(declaredLow, floor) > 0 ? declaredLow : floor;
        if (pinned === null) {
            notes.push(`.nvmrc "${nvmrc.trim()}" is not a version, not compared with the floor`);
        } else if (compare(pinned, required) < 0) {
            findings.push(
                `.nvmrc "${nvmrc.trim()}" resolves below the floor ${show(required)}; write ${show(required)}`
            );
        }
    }

    findings.push(...checkNpmFloor({ manifest, npmrc }));

    return { findings, notes, floor, owner };
};

/** `engines` as key-sorted JSON, so two objects holding the same pairs print and compare alike. */
const enginesText = (engines) => {
    const source = engines ?? {};
    return JSON.stringify(
        Object.fromEntries(
            Object.keys(source)
                .sort()
                .map((key) => [key, source[key]])
        )
    );
};

/**
 * The lockfile's root entry (`packages[""]`) mirrors the `engines` of package.json. When they differ,
 * the first `npm install` rewrites the lockfile and leaves it dirty, while `npm ci` still passes, so
 * nothing else notices. Pure: the caller reads the files.
 */
export const checkLockRootEngines = ({ manifest, lock }) => {
    const root = lock?.packages?.[''];
    if (typeof root !== 'object' || root === null) {
        return [
            'package-lock.json has no root entry (packages[""]), so its engines cannot be compared with package.json'
        ];
    }
    const declared = enginesText(manifest?.engines);
    const locked = enginesText(root.engines);
    if (declared === locked) return [];
    return [
        `package-lock.json packages[""].engines is ${locked} but package.json engines is ${declared}; npm rewrites the lockfile root on the next install and leaves it dirty. Copy the package.json engines into packages[""]`
    ];
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export const run = ({ root }) => {
    let manifest;
    let lock;
    try {
        manifest = readJson(path.join(root, 'package.json'));
        lock = readJson(path.join(root, 'package-lock.json'));
    } catch (error) {
        return {
            findings: [`package.json or package-lock.json cannot be read: ${error.message}`],
            notes: [],
            floor: null,
            owner: null
        };
    }
    let nvmrc = null;
    try {
        nvmrc = readFileSync(path.join(root, '.nvmrc'), 'utf8');
    } catch {
        // No .nvmrc: nothing to compare, and the engines check stands alone.
    }
    let npmrc = null;
    try {
        npmrc = readFileSync(path.join(root, '.npmrc'), 'utf8');
    } catch {
        // No .npmrc: no key that needs a newer npm, and the npm leg stays quiet.
    }
    const result = checkEnginesFloor({ manifest, lock, nvmrc, npmrc });
    return {
        ...result,
        findings: [...result.findings, ...checkLockRootEngines({ manifest, lock })]
    };
};

const main = () => {
    const argv = process.argv.slice(2);
    const rootFlag = argv.indexOf('--root');
    const root = rootFlag === -1 ? process.cwd() : path.resolve(argv[rootFlag + 1]);
    const { findings, notes, floor, owner } = run({ root });

    console.log('engines-floor');
    for (const note of notes) console.log(`  ! ${note}`);
    for (const finding of findings) console.log(`  ✖ ${finding}`);
    if (findings.length === 0) {
        console.log(
            `  ✔ engines.node and .nvmrc cover the strictest locked floor ${show(floor)}${owner ? ` (${owner})` : ''}, and the lockfile root engines match`
        );
        process.exit(0);
    }
    console.log(
        `\n✖ engines-floor: ${findings.length} finding(s). Raise engines.node, engines.npm and .nvmrc to the floor they need, or drop the dependency that needs it — never the check.`
    );
    process.exit(1);
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
