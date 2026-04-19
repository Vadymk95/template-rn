# Performance research loop (autoresearch-style)

Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch): **one comparable primary metric**, a **fixed measurement procedure**, and **narrow edit surface** so diffs stay reviewable.

## Primary metric

**`hermesBundleBytes`** — size of the iOS Hermes bytecode file (`.hbc`) produced by `expo export`. **Lower is better.**
Secondary: `exportAssetsBytes` (total bytes under `.atlas/assets/` for that export).

Web Vitals (LCP, INP, CLS) do not apply to native RN; this is the closest **CI-friendly** analogue to “bundle weight”.

## Fixed procedure (do not improvise)

1. From repo root: `npm run perf:capture`
   — runs `expo export` with `EXPO_ATLAS=1`, then writes metrics JSON via `scripts/capture-bundle-metrics.mjs`.
2. Compare printed `hermesBundleBytes` to `scripts/perf-baseline.json`.
3. If the change **intentionally** improves size and you accept the new baseline:
   `npm run perf:capture -- --write-baseline` (or run the underlying script with `--write-baseline`).

Optional gate: `npm run perf:check` — fails if bundle exceeds baseline by more than `PERF_THRESHOLD_PCT` (default 5%). Hermes `.hbc` size can jitter by a few bytes between exports; keep the threshold > 0% or refresh the baseline after intentional dependency upgrades.

## What to treat as “prepare.py” (avoid casual edits)

- `babel.config.js` (worklets plugin order)
- `metro.config.js` (NativeWind input path)
- `app.config.ts` (identifiers, scheme, OTA policy)
- `src/app/_layout.tsx` provider order

## Reasonable “train.py” (hypothesis → measure → keep/revert)

- Dependency changes (remove unused packages, replace heavy imports)
- Lazy loading / dynamic import where Metro supports it for your entry graph
- Icon font subsetting or switching icon strategy (large impact on **assets**, not always `.hbc`)

## What this does **not** replace

- Cold-start time, frame drops, memory: measure on **device** (Dev Menu perf monitor, profilers) or **RUM** (Sentry, etc.) when the product needs it.
