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

## No forms / i18n / auth libraries in the template

- These are opinionated product choices. Template stays minimal so every MVP
  picks the right library (RHF vs TanStack Form, i18next vs Lingui vs FormatJS,
  Clerk vs Supabase vs Auth0) without fighting the scaffold.

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
- Type-aware rules (`typescript-eslint` strict + stylistic) apply to **`src/**`only** so`app.config.ts` and tooling files do not require a TS project entry
  for lint.

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
- **Global branch coverage** is set to **10%** (statements/lines/functions stay
  **60%**). RN + logger + Query bootstrap produce many platform branches that are
  better covered by integration/E2E later than by artificial unit tests.
- **`src/shared/lib/constants/**`, `src/shared/lib/i18n/**`, and `src/shared/locales/**`**
are excluded from **`collectCoverageFrom`** — declarative tables / JSON / thin
init glue; correctness is typecheck + ESLint (`i18next/no-literal-string`in`src/app`) + manual smoke. Add tests when logic grows (e.g. dynamic route builders).
