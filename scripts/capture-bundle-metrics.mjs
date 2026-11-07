#!/usr/bin/env node
/**
 * Bundle metrics (Expo export + Atlas). Hermes .hbc bytes per platform — lower is better.
 *
 * Usage:
 *   node scripts/capture-bundle-metrics.mjs [--export] [--platform ios|android|all]
 *   node scripts/capture-bundle-metrics.mjs --write-baseline [--platform all]
 *   node scripts/capture-bundle-metrics.mjs --check [--platform ios|all]
 *
 * Env: PERF_THRESHOLD_PCT (default 5), PERF_PLATFORM=ios|android|all (default ios)
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isEntryPoint } from './is-entry-point.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'perf-baseline.json');

const ATLAS_IOS = join(ROOT, '.atlas');
const ATLAS_ANDROID = join(ROOT, '.atlas-android');

const DEFAULT_THRESHOLD_PCT = 5;

/**
 * The allowed growth in percent: the default when the variable is unset, NaN when it is set to
 * something that is not a number (an empty string would read as 0 through `Number`), so `checkPair`
 * can refuse it instead of a typo silently turning the budget off.
 */
export function readThresholdPct(env) {
    const raw = env['PERF_THRESHOLD_PCT'];
    if (raw === undefined) {
        return DEFAULT_THRESHOLD_PCT;
    }
    return raw.trim() === '' ? Number.NaN : Number(raw);
}

// Number.isFinite is false for a string, null and undefined, so no typeof check is needed.
const isPositiveFinite = (value) => Number.isFinite(value) && value > 0;

/**
 * Judges one platform's bundle against its baseline. Pure: returns { ok, message } and prints
 * nothing. A comparison with a NaN limit is false in both directions, so a missing or mistyped
 * number would pass as "within budget"; every input must be a usable number before it is compared.
 *
 * @param {{ name: string, currentBytes: unknown, baseBytes: unknown, thresholdPct: unknown }} input
 * @returns {{ ok: boolean, message: string }}
 */
export function checkPair({ name, currentBytes, baseBytes, thresholdPct }) {
    if (!isPositiveFinite(currentBytes)) {
        return {
            ok: false,
            message: `[perf] FAIL ${name}: measured bundle bytes is not a finite positive number (got ${String(currentBytes)})`
        };
    }
    if (!isPositiveFinite(baseBytes)) {
        return {
            ok: false,
            message: `[perf] FAIL ${name}: baseline bytes in scripts/perf-baseline.json is not a finite positive number (got ${String(baseBytes)})`
        };
    }
    if (!Number.isFinite(thresholdPct) || thresholdPct < 0) {
        return {
            ok: false,
            message: `[perf] FAIL ${name}: PERF_THRESHOLD_PCT is not a finite number of 0 or more (got ${String(thresholdPct)})`
        };
    }
    const limit = Math.floor(baseBytes * (1 + thresholdPct / 100));
    if (currentBytes > limit) {
        return {
            ok: false,
            message: `[perf] FAIL ${name}: ${currentBytes} > baseline+${thresholdPct}% (${limit}, baseline ${baseBytes})`
        };
    }
    return {
        ok: true,
        message: `[perf] OK ${name}: within +${thresholdPct}% of baseline (${baseBytes} bytes)`
    };
}

function parseArgs(argv) {
    const flags = new Set(argv.filter((a) => a.startsWith('-')));
    let platform = process.env['PERF_PLATFORM'] ?? 'ios';
    const pi = argv.indexOf('--platform');
    if (pi !== -1 && argv[pi + 1]) {
        platform = argv[pi + 1];
    }
    if (!['ios', 'android', 'all'].includes(platform)) {
        console.error(`Invalid --platform ${platform}, use ios|android|all`);
        process.exit(1);
    }
    return {
        export: flags.has('--export') || flags.has('-e'),
        writeBaseline: flags.has('--write-baseline') || flags.has('-w'),
        check: flags.has('--check') || flags.has('-c'),
        help: flags.has('--help') || flags.has('-h'),
        platform
    };
}

function gitShortSha() {
    try {
        return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function runExport(platform) {
    const outDir = platform === 'android' ? '.atlas-android' : '.atlas';
    const r = spawnSync('npx', ['expo', 'export', '--platform', platform, '--output-dir', outDir], {
        cwd: ROOT,
        env: { ...process.env, EXPO_ATLAS: '1' },
        stdio: 'inherit'
    });
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

function sumFileTreeBytes(dir) {
    let total = 0;
    const walk = (d) => {
        for (const ent of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, ent.name);
            if (ent.isDirectory()) {
                walk(p);
            } else {
                total += statSync(p).size;
            }
        }
    };
    walk(dir);
    return total;
}

/**
 * @param {'ios' | 'android'} platformKey
 * @param {string} atlasRoot absolute path to export dir
 */
function captureOne(platformKey, atlasRoot) {
    const metaPath = join(atlasRoot, 'metadata.json');
    if (!existsSync(metaPath)) {
        throw new Error(`Missing ${metaPath}. Run with --export first.`);
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const plat = meta?.fileMetadata?.[platformKey];
    if (!plat?.bundle) {
        throw new Error(`metadata.json: missing fileMetadata.${platformKey}.bundle`);
    }

    const bundlePath = join(atlasRoot, plat.bundle);
    if (!existsSync(bundlePath)) {
        throw new Error(`Bundle file not found: ${bundlePath}`);
    }

    const hermesBundleBytes = statSync(bundlePath).size;
    const assetsDir = join(atlasRoot, 'assets');
    const assetsBytes = existsSync(assetsDir) ? sumFileTreeBytes(assetsDir) : 0;

    return {
        hermesBundleFile: plat.bundle,
        metrics: {
            hermesBundleBytes,
            exportAssetsBytes: assetsBytes,
            hermesBundleMb: Math.round((hermesBundleBytes / (1024 * 1024)) * 1000) / 1000
        }
    };
}

function loadBaseline() {
    if (!existsSync(BASELINE_PATH)) {
        return null;
    }
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function main() {
    const thresholdPct = readThresholdPct(process.env);
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(`Usage:
  node scripts/capture-bundle-metrics.mjs [--export] [--platform ios|android|all]
  node scripts/capture-bundle-metrics.mjs --write-baseline [--platform all]
  node scripts/capture-bundle-metrics.mjs --check [--platform ios|all]

Env:
  PERF_THRESHOLD_PCT   Regressions allowed (default: ${DEFAULT_THRESHOLD_PCT}, a number of 0 or more)
  PERF_PLATFORM        Default platform if --platform omitted
`);
        process.exit(0);
    }

    if (args.export) {
        if (args.platform === 'all') {
            runExport('ios');
            runExport('android');
        } else {
            runExport(args.platform);
        }
    }

    const sha = gitShortSha();
    const capturedAt = new Date().toISOString();

    /** @type {object} */
    let report;

    if (args.platform === 'all') {
        const ios = captureOne('ios', ATLAS_IOS);
        const android = captureOne('android', ATLAS_ANDROID);
        report = {
            schemaVersion: 2,
            capturedAt,
            gitSha: sha,
            platforms: { ios, android }
        };
        console.error(
            `[perf] ios .hbc ${ios.metrics.hermesBundleBytes} bytes (${ios.metrics.hermesBundleMb} MiB), assets ${ios.metrics.exportAssetsBytes}`
        );
        console.error(
            `[perf] android .hbc ${android.metrics.hermesBundleBytes} bytes (${android.metrics.hermesBundleMb} MiB), assets ${android.metrics.exportAssetsBytes}`
        );
    } else {
        const atlasRoot = args.platform === 'android' ? ATLAS_ANDROID : ATLAS_IOS;
        const one = captureOne(args.platform, atlasRoot);
        report = {
            schemaVersion: 1,
            capturedAt,
            gitSha: sha,
            platform: args.platform,
            hermesBundleFile: one.hermesBundleFile,
            metrics: one.metrics
        };
        console.error(
            `[perf] ${args.platform} .hbc ${one.metrics.hermesBundleBytes} bytes (${one.metrics.hermesBundleMb} MiB), assets ${one.metrics.exportAssetsBytes}`
        );
    }

    if (args.writeBaseline) {
        mkdirSync(dirname(BASELINE_PATH), { recursive: true });
        writeFileSync(BASELINE_PATH, `${JSON.stringify(report, null, 4)}\n`, 'utf8');
        console.error(`[perf] wrote ${BASELINE_PATH}`);
    }

    console.log(JSON.stringify(report, null, 2));

    if (args.check) {
        const baseline = loadBaseline();
        if (!baseline) {
            console.error('[perf] --check: no baseline. Run with --write-baseline first.');
            process.exit(2);
        }

        const judge = (name, currentBytes, baseBytes) => {
            const result = checkPair({ name, currentBytes, baseBytes, thresholdPct });
            console.error(result.message);
            return result.ok;
        };

        if (baseline.schemaVersion === 2 && baseline.platforms) {
            if (args.platform !== 'all') {
                console.error(
                    '[perf] v2 baseline: run --check with --platform all (after --export --platform all)'
                );
                process.exit(2);
            }
            const iosOk = judge(
                'ios',
                report.platforms.ios.metrics.hermesBundleBytes,
                baseline.platforms.ios?.metrics?.hermesBundleBytes
            );
            const androidOk = judge(
                'android',
                report.platforms.android.metrics.hermesBundleBytes,
                baseline.platforms.android?.metrics?.hermesBundleBytes
            );
            if (!iosOk || !androidOk) {
                process.exit(1);
            }
        } else if (baseline.metrics?.hermesBundleBytes) {
            if (args.platform !== 'ios') {
                console.error(
                    '[perf] v1 baseline is iOS-only; use --platform ios or run --write-baseline --platform all'
                );
                process.exit(2);
            }
            if (
                !judge('ios', report.metrics.hermesBundleBytes, baseline.metrics.hermesBundleBytes)
            ) {
                process.exit(1);
            }
        } else {
            console.error(
                '[perf] --check: unrecognized baseline shape. Restore scripts/perf-baseline.json from master'
            );
            process.exit(2);
        }
    }
}

// Guarded so importing this module for a test does not run an export or read a baseline.
if (isEntryPoint(import.meta.url)) {
    try {
        main();
    } catch (e) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }
}
