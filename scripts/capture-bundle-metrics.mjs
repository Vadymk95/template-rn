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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'perf-baseline.json');

const ATLAS_IOS = join(ROOT, '.atlas');
const ATLAS_ANDROID = join(ROOT, '.atlas-android');

const DEFAULT_THRESHOLD_PCT = Number(process.env['PERF_THRESHOLD_PCT'] ?? 5);

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
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(`Usage:
  node scripts/capture-bundle-metrics.mjs [--export] [--platform ios|android|all]
  node scripts/capture-bundle-metrics.mjs --write-baseline [--platform all]
  node scripts/capture-bundle-metrics.mjs --check [--platform ios|all]

Env:
  PERF_THRESHOLD_PCT   Regressions allowed (default: ${DEFAULT_THRESHOLD_PCT})
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

        const checkPair = (name, currentBytes, baseBytes) => {
            const limit = Math.floor(baseBytes * (1 + DEFAULT_THRESHOLD_PCT / 100));
            if (currentBytes > limit) {
                console.error(
                    `[perf] FAIL ${name}: ${currentBytes} > baseline+${DEFAULT_THRESHOLD_PCT}% (${limit}, baseline ${baseBytes})`
                );
                return false;
            }
            console.error(
                `[perf] OK ${name}: within +${DEFAULT_THRESHOLD_PCT}% of baseline (${baseBytes} bytes)`
            );
            return true;
        };

        if (baseline.schemaVersion === 2 && baseline.platforms) {
            if (args.platform !== 'all') {
                console.error(
                    '[perf] v2 baseline: run --check with --platform all (after --export --platform all)'
                );
                process.exit(2);
            }
            const iosOk = checkPair(
                'ios',
                report.platforms.ios.metrics.hermesBundleBytes,
                baseline.platforms.ios.metrics.hermesBundleBytes
            );
            const androidOk = checkPair(
                'android',
                report.platforms.android.metrics.hermesBundleBytes,
                baseline.platforms.android.metrics.hermesBundleBytes
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
                !checkPair(
                    'ios',
                    report.metrics.hermesBundleBytes,
                    baseline.metrics.hermesBundleBytes
                )
            ) {
                process.exit(1);
            }
        } else {
            console.error('[perf] --check: unrecognized baseline shape');
            process.exit(2);
        }
    }
}

try {
    main();
} catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
}
