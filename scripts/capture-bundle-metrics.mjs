#!/usr/bin/env node
/**
 * Bundle metrics capture (Expo export + Atlas output under `.atlas/`).
 * Primary metric (Karpathy-style single number): iOS Hermes bytecode (.hbc) size — lower is better.
 *
 * Usage:
 *   node scripts/capture-bundle-metrics.mjs              # read existing `.atlas/` only
 *   node scripts/capture-bundle-metrics.mjs --export   # run `expo export` first (slower, reproducible)
 *   node scripts/capture-bundle-metrics.mjs --write-baseline
 *   node scripts/capture-bundle-metrics.mjs --check      # fail if .hbc exceeds baseline + threshold
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ATLAS = join(ROOT, '.atlas');
const BASELINE_PATH = join(__dirname, 'perf-baseline.json');

const DEFAULT_THRESHOLD_PCT = Number(process.env['PERF_THRESHOLD_PCT'] ?? 5);

function parseArgs(argv) {
    const flags = new Set(argv.filter((a) => a.startsWith('-')));
    return {
        export: flags.has('--export') || flags.has('-e'),
        writeBaseline: flags.has('--write-baseline') || flags.has('-w'),
        check: flags.has('--check') || flags.has('-c'),
        help: flags.has('--help') || flags.has('-h')
    };
}

function gitShortSha() {
    try {
        return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function runExport() {
    const r = spawnSync('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', '.atlas'], {
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

function captureMetrics() {
    const metaPath = join(ATLAS, 'metadata.json');
    if (!existsSync(metaPath)) {
        throw new Error(
            `Missing ${metaPath}. Run: node scripts/capture-bundle-metrics.mjs --export`
        );
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const ios = meta?.fileMetadata?.ios;
    if (!ios?.bundle) {
        throw new Error('metadata.json: missing fileMetadata.ios.bundle');
    }

    const bundlePath = join(ATLAS, ios.bundle);
    if (!existsSync(bundlePath)) {
        throw new Error(`Bundle file not found: ${bundlePath}`);
    }

    const hermesBundleBytes = statSync(bundlePath).size;
    const assetsDir = join(ATLAS, 'assets');
    const assetsBytes = existsSync(assetsDir) ? sumFileTreeBytes(assetsDir) : 0;

    return {
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        gitSha: gitShortSha(),
        platform: 'ios',
        hermesBundleFile: ios.bundle,
        metrics: {
            /** Primary: Hermes bytecode size (bytes). Lower is better. */
            hermesBundleBytes,
            /** Secondary: hashed assets shipped with this export (bytes). */
            exportAssetsBytes: assetsBytes,
            /** Convenience */
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
  node scripts/capture-bundle-metrics.mjs [--export] [--write-baseline] [--check]

  --export          Run EXPO_ATLAS=1 expo export --platform ios --output-dir .atlas first
  --write-baseline  Write scripts/perf-baseline.json from captured metrics
  --check           Exit 1 if hermesBundleBytes > baseline * (1 + PERF_THRESHOLD_PCT/100)

Env:
  PERF_THRESHOLD_PCT   Regressions allowed over baseline (default: ${DEFAULT_THRESHOLD_PCT})
`);
        process.exit(0);
    }

    if (args.export) {
        runExport();
    }

    const report = captureMetrics();
    const line = `[perf] ios .hbc ${report.metrics.hermesBundleBytes} bytes (${report.metrics.hermesBundleMb} MiB), assets ${report.metrics.exportAssetsBytes} bytes`;
    console.error(line);

    if (args.writeBaseline) {
        mkdirSync(dirname(BASELINE_PATH), { recursive: true });
        writeFileSync(BASELINE_PATH, `${JSON.stringify(report, null, 4)}\n`, 'utf8');
        console.error(`[perf] wrote ${BASELINE_PATH}`);
    }

    console.log(JSON.stringify(report, null, 2));

    if (args.check) {
        const baseline = loadBaseline();
        if (!baseline?.metrics?.hermesBundleBytes) {
            console.error('[perf] --check: no baseline. Run with --write-baseline first.');
            process.exit(2);
        }
        const baseBytes = baseline.metrics.hermesBundleBytes;
        const limit = Math.floor(baseBytes * (1 + DEFAULT_THRESHOLD_PCT / 100));
        if (report.metrics.hermesBundleBytes > limit) {
            console.error(
                `[perf] FAIL: hermesBundleBytes ${report.metrics.hermesBundleBytes} > baseline+${DEFAULT_THRESHOLD_PCT}% (${limit}, baseline ${baseBytes})`
            );
            process.exit(1);
        }
        console.error(
            `[perf] OK: within +${DEFAULT_THRESHOLD_PCT}% of baseline (${baseBytes} bytes)`
        );
    }
}

try {
    main();
} catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
}
