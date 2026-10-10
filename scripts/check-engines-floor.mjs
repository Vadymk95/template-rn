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
 * What it reads: `engines.node` in package.json, every `engines.node` in package-lock.json, and
 * `.nvmrc` when there is one.
 *
 * Findings (each printed on its own line; exit 1 when any exists):
 *   engines   the lowest version of the declared major that a locked package admits, taken over all
 *             packages, is above the lowest version `engines.node` admits. The strictest package is
 *             named, with the value to write.
 *   admits    a locked package admits no version of the declared major at all.
 *   nvmrc     `.nvmrc` resolves below the floor (the larger of the declared and the locked one): a
 *             contributor on the pinned version would be the first to hit the refusal.
 *   shape     package.json has no `engines.node`, or one with no lower bound.
 *
 * Not counted: the root entry of the lockfile (it is the manifest), and `optional` packages (npm
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

export const checkEnginesFloor = ({ manifest, lock, nvmrc }) => {
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
                `.nvmrc "${nvmrc.trim()}" resolves below the floor ${show(required)}; write ${required[0]}.${required[1]}`
            );
        }
    }

    return { findings, notes, floor, owner };
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
    return checkEnginesFloor({ manifest, lock, nvmrc });
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
            `  ✔ engines.node and .nvmrc cover the strictest locked floor ${show(floor)}${owner ? ` (${owner})` : ''}`
        );
        process.exit(0);
    }
    console.log(
        `\n✖ engines-floor: ${findings.length} finding(s). Raise engines.node and .nvmrc to the locked floor, or drop the dependency that needs it — never the check.`
    );
    process.exit(1);
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
