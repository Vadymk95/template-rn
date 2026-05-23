# DECISIONS — Why these, not others

Short record of non-obvious trade-offs. Update when reversing a decision.

## Expo managed > bare React Native

- EAS Build removes the Mac requirement for iOS, which is the #1 solo-dev
  blocker.
- `app.config.ts` + prebuild (Continuous Native Generation) lets the repo stay
  clean — no hand-edited `ios/Podfile` drift.
- Config plugins cover every OEM SDK we've needed so far.
- Revisit if we need a native module with no plugin we can't write ourselves.

## Expo Router v55 > React Navigation standalone

- File-based routes match Next.js App Router mental model.
- Typed routes, deep links, and URL handling are free.
- Bundle cost is acceptable for MVP.

## Expo SDK 55 baseline

- SDK 55 released Jan 2026 as stable, with React Native 0.83 + React 19.2.
- Legacy Architecture was **dropped** in SDK 55 — New Arch is the only option,
  so `newArchEnabled: true` is no longer a meaningful flag.
- React Compiler is stable, wired via `experiments.reactCompiler: true`.

## NativeWind 4.2, not v5

- v5 requires Tailwind v4 and is still pre-stable.
- v4.2 ships the Reanimated v4 compatibility patch.
- Revisit when v5 goes stable.

## Design tokens are vocabulary, not call sites

- `TYPOGRAPHY_TOKENS` and `SPACING_TOKENS` (`src/shared/lib/theme/**`) define the template's typography scale and spacing ladder. They are an **API surface for future slices**, not application code with usage counts.
- Do **not** trim tokens by the «no external references» criterion — in a template, zero references means «not used _yet_», not «dead».
- Extend the scale when a new slice needs a coherent step; remove only when a token is _semantically wrong_ (ambiguous name, contradicts the ladder, or a duplicate).
- The same rule applies to `src/shared/lib/constants/**` declarative tables, route maps, and any other vocabulary exposed to features/widgets.

## Icons: `@expo/vector-icons`, not `lucide-react-native`

- `@expo/vector-icons` ships in Expo with zero extra install and covers 20+
  icon sets (Ionicons, MaterialCommunity, Feather, FontAwesome).
- lucide-react-native is nicer-looking but adds a dep and requires `react-native-svg`
  round-trips. For a generic MVP template, the stock set is the better default.

## Jest + jest-expo, not Vitest

- Vitest RN support via `@vitest/browser` is improving but still rough with
  Reanimated / NativeWind mocks.
- `jest-expo` ships the correct `transformIgnorePatterns` out of the box.
- Revisit in 6 months.

## Testing matchers: built-in, not `@testing-library/jest-native`

- `@testing-library/jest-native` is deprecated. React Native Testing Library
  v12.4+ ships equivalent matchers automatically when you import from it.
- No extra setup required beyond the mocks in `src/test/setup.ts`.

## `expo-secure-store` for tokens, AsyncStorage for cache

- AsyncStorage is plaintext on both platforms.
- `expo-secure-store` uses Keychain (iOS) / EncryptedSharedPreferences (Android).
- Rule: anything that grants API access goes to secure-store.

## No observability vendor in the template

- `logger.ts` is a stub with a stable API. Pick Sentry / Datadog / Bugsnag in
  the product, implement `report.capture` and `report.breadcrumb`, call sites
  do not change.

## i18n + forms in the template vs vendor/auth

- **i18next + react-i18next** ship with bundled JSON, typed keys, and
  `expo-localization` for the initial language. Remote-only catalogs (Phrase,
  Lokalise HTTP, CMS strings) stay a product integration.
- **react-hook-form + `@hookform/resolvers` (Zod)** ship as the default for
  non-trivial inputs; TanStack Form or codegen-heavy stacks remain product
  choices. Single-field UI may still use local state per engineering standards.
- **No auth or crash-reporting SDK** in the scaffold — pick Clerk / Supabase /
  Sentry (etc.) when the product needs them.

## `@t3-oss/env-core` + Zod

- Fails startup on missing vars, which is cheaper than a runtime 500 on first
  API call.

## Oxlint before ESLint in `lint-staged`

- Oxlint catches obvious bugs in milliseconds; ESLint is the source of truth.
- Pre-pass keeps pre-commit fast on large changesets.

## 4-space indent, single quotes

- Personal preference (`.prettierrc.json`). Community RN norm is 2 spaces —
  adjust if onboarding friction becomes real.

## ESLint 9 (not 10) + `eslint-config-expo`

- ESLint **10** currently trips `eslint-plugin-react` inside `eslint-config-expo`
  (`getFilename` / resolver edge cases). **ESLint 9.39.x** is the pragmatic pin
  until Expo’s flat config stack catches up.
- Type-aware `typescript-eslint` rules are scoped to **`src/**`** so `app.config.ts` and other root tooling stay outside the type-aware project surface.

## `react-dom` override + `react@19.2.0`

- Expo pins **React 19.2.0**; npm 10 may hoist **`react-dom@19.2.5`**, which peers
  **`react@^19.2.5`** and breaks installs. Root **`overrides.react-dom`:
  `"19.2.0"`** keeps the tree coherent while staying on Expo’s React pin.

## `react-native-worklets@0.7.4` + `expo.install.exclude`

- **`expo-modules-core`** (pulled in via `expo`) expects worklets **`>=0.7.4`** for
  optional peers; **`expo install --fix`** still suggests **0.7.2**. We run
  **0.7.4** and list **`react-native-worklets`** under **`expo.install.exclude`**
  so `expo install --check` stays green without fighting Reanimated’s range.

## `babel-preset-expo` as a devDependency

- `jest-expo` invokes Babel using the app `babel.config.js`; **`babel-preset-expo`**
  must be resolvable from the project root for **`npm test`** to run.

## Jest coverage thresholds and exclusions

- **`@t3-oss/env-core` ships as ESM**; transforming it inside Jest for a tiny env
  smoke test is not worth the config surface for a template. **`src/env.ts`**
  is excluded from **`collectCoverageFrom`** — it is still enforced at runtime by
  Zod + `createEnv`.
- **Coverage thresholds** are set to **statements/lines/functions 80%, branches 60%** — tuned to the current logic-layer test surface after excluding `src/app/`, `src/env.ts`, `src/shared/lib/i18n/`, `src/shared/lib/constants/`, and `src/shared/locales/**`.
- **`src/shared/lib/constants/**`, `src/shared/lib/i18n/**`, and `src/shared/locales/**`** are excluded from **`collectCoverageFrom`** — declarative tables, JSON, and thin init glue; correctness is typecheck, ESLint (`i18next/no-literal-string`in`src/app`), and manual smoke. Add tests when logic grows (for example dynamic route builders).

## Audit hygiene adopted in-repo (template maintenance)

The following were merged as **scaffold fixes** (not product features): Husky hook scripts so `lint-staged` / `commitlint` / pre-push `typecheck+test` actually run; `app.config.ts` gates `extra.eas` + `updates.url` on `EAS_PROJECT_ID`; iOS `privacyManifests` for required-reason APIs; empty default `android.permissions` / minimal `infoPlist` until a feature needs sensors; `.env.example` aligned with `src/env.ts`; CI `permissions: contents: read`; `react-i18next` aligned with `i18next@26`; TanStack Query default retry skips 4xx; auth token storage in `expo-secure-store` via `src/lib/secureToken.ts` with username-only Zustand persist; `engines.node` floor matches `.nvmrc` (24).

**Completed since the audit was written** — no action required:

- splash hold until i18n (handled by `src/app/_layout.tsx` + `src/shared/lib/i18n/I18nInitErrorFallback.tsx`)
- custom ErrorBoundary UI (`src/shared/ui/ErrorBoundary/`)

**Still deferred to product MVP** — adopt when the listed trigger hits:

- HTTP client module — add when the first authenticated API surface lands
- Navigation test mocks — add when routing assertions appear in tests
- SHA-pinned Actions beyond `permissions` — adopt if the repo becomes a public/org template
- FSD `hooks/` boundary split — revisit if `src/hooks/` grows past a handful of entries

## Audit backlog (P0–P2): what the template adopts vs defers

Recorded so forks do not re-litigate the same list. **Ghost principle:** only items marked **Adopt** belong in-repo; the rest are README / product follow-ups. For a **narrative** (strengths vs deferred tools, adoption triggers, comparison to opinionated starters), see **`PROJECT_CONTEXT.md` → “Full scope: strengths vs deferred tools”.**

| Tier | Item                                       | Template decision                                                                                                                                                                                      |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0   | MMKV swap for AsyncStorage                 | **Defer** — AsyncStorage + Jest mock is zero-native-cost; MMKV is a second persistence story (native module, CI, Zustand adapter). Add when perf or sync API is a real constraint.                     |
| P0   | Sentry + source maps in CI                 | **Defer or polarize** — either wire `@sentry/react-native` + upload, or remove `EXPO_PUBLIC_SENTRY_DSN` until then; optional env key without SDK confuses authors.                                     |
| P0   | HTTP client + interceptors in `shared/api` | **Defer** — `fetch` + TanStack Query is enough for a skeleton; axios/ky/opinionated interceptors are product-shaped (auth refresh, error taxonomy). Document “add client when first real API surface”. |
| P0   | Maestro E2E smoke                          | **Defer** — high value for teams, but extra toolchain for a first-time RN author; add after first release candidate or when CI budget allows.                                                          |
| P0   | TanStack Query persist + NetInfo + MMKV    | **Defer** — offline-first is a product decision; doubles persistence + cache invalidation story. Query already refetches on foreground.                                                                |
| P1   | expo-image default wrapper                 | **Defer** — add when remote images / blurhash matter; until then `Image` or no images keeps bundle lean.                                                                                               |
| P1   | react-hook-form + zod resolvers            | **Adopted** — deps + Zod resolvers in tree; single-field inputs may still use `useState` per `engineering-standards.mdc`.                                                                              |
| P1   | FlashList                                  | **Defer** — add with first long list; wrapper in `shared` before need violates FSD ghost principle.                                                                                                    |
| P1   | Bundle size budget in CI                   | **Defer as a default workflow step** — in-repo `perf:*` scripts + baseline JSON support optional numeric checks; enabling them in GHA stays a product/team choice until baselines stabilize.           |
| P1   | actions/cache npm + Metro in GHA           | **Conditional** — adopt when CI runtime hurts; trivial add, low opinion risk.                                                                                                                          |
| P1   | EAS Update Hermes bytecode diff            | **Defer** — opt-in/beta surface; track Expo release notes, not template default.                                                                                                                       |
| P2   | eslint-plugin-react-native-a11y            | **Defer** — useful; enable when screen set grows (noise on early stubs).                                                                                                                               |
| P2   | keyboard-controller                        | **Defer** — add when forms hit keyboard overlap.                                                                                                                                                       |
| P2   | expo-notifications + universal links       | **Defer** — product/domain.                                                                                                                                                                            |
| P2   | Preview EAS on every PR                    | **Defer** — cost + secrets; document in SKELETONS for teams that want it.                                                                                                                              |
| P2   | Storybook RN                               | **Defer** — heavy for starter; optional doc link.                                                                                                                                                      |
| P2   | gitleaks in CI                             | **Conditional** — good for org templates; public solo template often uses GitHub secret scanning only.                                                                                                 |
| P2   | jailbreak detection                        | **Defer** — niche (finance / high-assurance).                                                                                                                                                          |
| P2   | tailwind-variants / CVA                    | **Defer** — NativeWind + clsx already chosen; second styling abstraction needs justification.                                                                                                          |
| P2   | Zustand persist on MMKV                    | **Defer** — same as P0 MMKV; ties store layer to native KV choice.                                                                                                                                     |

## React Compiler silent-bailout awareness (2026-05-23)

**Decision**: keep `experiments.reactCompiler: true` AND `eslint-plugin-react-compiler@^19.1.0-rc.2` AND `eslint-plugin-react-hooks@^7.1.1` (devDep). React hooks rules wired via `eslint-config-expo` (at `recommended` tier — provides `rules-of-hooks` + `exhaustive-deps`). Add `npm run verify:rc` (`react-compiler-healthcheck src`) as opt-in audit (NOT folded into `verify` or `ci:local`).

**`recommended-latest` deferred**: attempted to wire `reactHooks.configs['recommended-latest']` in `eslint.config.mjs` (would add Compiler-correctness rules like `static-components`, `component-hook-factories`), but failed under flat-config — `eslint-config-expo` bundles an older `react-hooks` v5 internally; the v7-specific rules don't resolve against expo's plugin instance. Tracked: re-attempt when `eslint-config-expo@^57` bundles react-hooks v7+ OR when `eslint-plugin-react-hooks` ships a `configs.flat[*]` export shape that lets us override the plugin instance via flat-config.

**Known silent-bailout bugs as of 2026-05-23** (`Status: Unconfirmed`, no assignees):

- [facebook/react#35105](https://github.com/facebook/react/issues/35105) (Nov 11, 2025) — `eslint-disable` incorrectly suppresses incompatible-library warning, causing silent memoization skip.
- [facebook/react#35644](https://github.com/facebook/react/issues/35644) (Jan 27, 2026) — `eslint-plugin-react-hooks` silent bailout when try/catch/finally block in the same component body.

**Independent N=1 real-world signal** (Nadia Makarevich, [developerway.com Dec 4, 2024](https://www.developerway.com/posts/how-react-compiler-performs-on-real-code)) — mixed-positive: theme toggle TBT 280→0ms, checkbox 130→90ms, but Compiler fixed only 1-2 of 8-10 noticeable re-renders. Manual memoization still needed for fine-tuning.

**Escape hatch**: file-level `"use no memo"` directive at top of file. Use when Compiler bailout causes observable regression.

**Revisit trigger (quarterly, starting 2026-08-23)**: check both bugs' `state` via `gh api` — if `closed`, drop awareness section.

**Why NOT enabled in web siblings**: /consilium 2026-05-23 vetoed Items 2/3/4 (Compiler enable in template-1, template-next-seo, template-spa-pwa) on unanswerable Adversarial killer Q ("Name one Compiler-enabled production app at >100K MAU where #35105 or #35644 reproducers have been ruled out as of 2026-05-23") + Vite team Mar 2026 blog warning that adding `babel-loader` eliminates most Oxc gains. template-rn keeps Compiler because RN ships no Oxc-vs-Babel ADR conflict.

## Sentry RN integration pattern (post-Shopify perf deprecation 2026-05-23)

**Decision**: document `@sentry/react-native` as the recommended (NOT bundled) replacement for the deprecated `@shopify/react-native-performance`. Consumers wire SDK in their product fork; template stays SDK-free per "No observability vendor in the template" ADR.

**Context**: [Shopify/react-native-performance](https://github.com/Shopify/react-native-performance) archived 2025-11-26 — README verbatim "no longer maintained...deprecated" + **no successor named upstream**. Community 2026 playbooks ([RapidNative 2026](https://www.rapidnative.com/blogs/react-native-performance-optimization-2026-playbook)) converge on Sentry RN + Firebase Performance Monitoring + Hermes sampling profiler. `@sentry/react-native` 1.9M weekly DLs = RN telemetry leader. **Sentry doesn't self-claim successor** — successor framing is third-party.

**Integration recipe** (for consumer fork, not for template):

```ts
// src/lib/sentry.ts — consumer adds this, NOT shipped in template
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        integrations: [Sentry.hermesProfilingIntegration({ platformProfilers: true })],
        environment: Constants.expoConfig?.extra?.appVariant ?? 'development',
        enableNative: true
    });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
export const captureException = Sentry.captureException;
export const wrap = Sentry.wrap;
```

Then `Sentry.wrap()` the root layout. EAS Build source-map upload via `@sentry/react-native/expo` config plugin.

**Env**: `.env.example` already has `EXPO_PUBLIC_SENTRY_DSN=` empty default. **Forks should either wire SDK + DSN or remove the env key entirely** (P0 audit backlog "Defer or polarize" stance).

**Privacy note**: Sentry RN can capture PII. Forks shipping mortgage/payment/health data must configure `beforeSend` PII scrubbing + opt out of replays.

**Revisit trigger (60-day, 2026-07-23)**: if Datadog RN or Embrace mainstream share crosses Sentry's 1.9M DLs, re-evaluate default.

## REJECT list — explicit non-adoption (2026-05-23 /consilium)

**Decision**: explicit DO-NOT-ADOPT register so future agents + forks don't re-litigate. Per /consilium 2026-05-23 APPLY Item 14.

### memlab (Meta heap-snapshot leak detector)

**Status**: skip by default. **Why**: 158K weekly DLs (May 2026), **ZERO published GitHub releases** ([facebook/memlab/releases](https://github.com/facebook/memlab/releases) verbatim "There aren't any releases here"), 0 of 8 React Doctor leaderboard flagship repos use in CI. Adopt only if memory-leak class bug observed.
**Revisit (90-day, 2026-08-23)**: memlab v2.0+ formal releases + ≥1 named React app >10K MAU memlab-CI case study.

### why-did-you-render (WDYR)

**Status**: skip in template-rn (React Compiler enabled here). **Why**: WDYR README declares itself "completely incompatible with React Compiler" ([welldone-software/why-did-you-render](https://github.com/welldone-software/why-did-you-render)). Replacement = React DevTools Profiler "Memo ✨" badge + React 19.2 Performance Tracks API.
**Revisit (no trigger)**: WDYR + Compiler-on structurally incompatible.

### react-native-flipper

**Status**: sunset. **Why**: deprecated RN 0.73 + removed from boilerplate RN 0.74 ([Flipper OSS blog 2024-10-24](https://fbflipper.com/blog/2024/10/24/changes-to-oss-flipper/)). React Native DevTools is official replacement.
**Revisit (no trigger)**: permanent.

### `@shopify/react-native-performance`

**Status**: deprecated upstream 2025-11-26. See `## Sentry RN integration pattern` for community-named replacement.
**Revisit (no trigger)**: deprecation final.

### Zstd compression plugin (RN context)

**Status**: not applicable (Metro/Hermes shipping path, not HTTP origin). Web-template note: Brotli universal in 2026; Safari Zstd landed 26.3 Feb 11, 2026 ([WebKit blog](https://webkit.org/blog/17798/webkit-features-for-safari-26-3/)), caniuse global 45/100 — Brotli still mandatory.
**Revisit (no trigger)**: RN doesn't ship HTTP-encoded JS.

## Deferred: SDK 56 migration

**Status**: attempted 2026-05-23, REVERTED to SDK 55 due to surfacing **360 TypeScript errors** during typecheck — root causes include `expo/tsconfig.base` SDK 56 no longer auto-injecting Jest globals (`expect`/`describe`/`it` lost), `ExpoConfig.splash` field migration, Expo Router v56 stricter `TabIconProps` typing (ColorValue vs string), and React Native 0.85 strict index signatures on accessibility/className props. Migration ran cleanly per `expo install --fix` + `expo-doctor` 18/18, but tsc strict-typecheck broke at scale. Not a 5-min fix.

**Deferred until**: dedicated session with budget for migration walkthrough — (1) `"types": ["jest"]` add to tsconfig OR `@types/jest` realignment, (2) `app.config.ts` splash field migration to `expo-splash-screen` plugin config, (3) `(tabs)/_layout.tsx` TabIconProps type widening or import `ColorValue` from `react-native`, (4) RN 0.85 index-signature audit (add `[key: string]: unknown` or explicit prop typing per offending component), (5) NativeWind className typing reconciliation.

**Revisit when**: time budget ≥2h available for surgical migration + verification pass.
