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

## Jest coverage: `src/env.ts` excluded, branch threshold 10%

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
