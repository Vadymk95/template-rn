# Performance research loop (autoresearch-style)

Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch): **one comparable primary metric**, a **fixed measurement procedure**, and **narrow edit surface** so diffs stay reviewable.

## Primary metric

**`hermesBundleBytes`** — size of the Hermes bytecode file (`.hbc`) produced by `expo export` per platform (`ios` / `android`). **Lower is better.**

Secondary: `exportAssetsBytes` (total bytes under `<export-dir>/assets/` for that export).

Web Vitals (LCP, INP, CLS) do not apply to native RN; this is the closest **CI-friendly** analogue to “bundle weight”.

**Full mobile pass:** `npm run perf:capture:all` — exports to `.atlas/` (iOS) and `.atlas-android/` (Android), then prints a **schema v2** JSON with both platforms (both dirs are gitignored).

## Fixed procedure (do not improvise)

1. From repo root: `npm run perf:capture` (iOS only) or `npm run perf:capture:all` (iOS + Android)
   — runs `expo export` with `EXPO_ATLAS=1`, then writes metrics JSON via `scripts/capture-bundle-metrics.mjs`.
2. Compare printed `hermesBundleBytes` to `scripts/perf-baseline.json` (v1 = iOS-only legacy; v2 = both platforms).
3. If the change **intentionally** shifts size and you accept the new baseline: `npm run perf:baseline` (writes **v2** with iOS + Android).

Optional gate: `npm run perf:check` — compares **both** platforms to a **v2** baseline; fails if either `.hbc` exceeds baseline by more than `PERF_THRESHOLD_PCT` (default 5%). Hermes `.hbc` size can jitter slightly between exports; keep the threshold > 0% or refresh the baseline after intentional dependency upgrades.

**Legacy:** v1 baselines still work with `perf:capture` + `--check --platform ios` via the script directly; migrate with `npm run perf:baseline`.

## What to treat as “prepare.py” (avoid casual edits)

- `babel.config.js` (worklets plugin order)
- `metro.config.js` (NativeWind input path)
- `app.config.ts` (identifiers, scheme, OTA policy)
- `src/app/_layout.tsx` provider order

## Reasonable “train.py” (hypothesis → measure → keep/revert)

- Dependency changes (remove unused packages, replace heavy imports)
- Lazy loading / dynamic import where Metro supports it for your entry graph
- Icon font subsetting or switching icon strategy (large impact on **assets**, not always `.hbc`)
- **Android assets vs iOS:** `expo-router` pulls `expo-symbols` → `@expo-google-fonts/material-symbols` (several TTF weights). That inflates **Android** `exportAssetsBytes` vs iOS; removing or replacing `expo-symbols` usage is the lever if you need a smaller asset footprint.
- **Current repo workaround:** `metro.config.js` resolves Android Material Symbols font requests as `empty` because this template does not use `expo-symbols` directly. Keep validating with `npm run perf:capture:all` after Expo / Router upgrades until upstream makes the dependency optional or lazy.

## What this does **not** replace

- Cold-start time, frame drops, memory: measure on **device** (Dev Menu perf monitor, profilers) or **RUM** (Sentry, etc.) when the product needs it.
