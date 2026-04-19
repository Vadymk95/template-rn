# template-rn — Project Context

## Purpose

Production-ready React Native + Expo foundation. Mirrors the philosophy of
`template-1` (React SPA) — strict types, validated env, declarative pipeline —
adapted for mobile: file-based routing, native dependencies via config plugins,
OTA updates, cloud builds.

This is a **generic MVP template**. No vendor auth, analytics, or crash
reporting — wire those when the product needs them. **i18next** (bundled JSON +
typed keys) and **react-hook-form** with Zod resolvers ship as defaults; remote
translation delivery and heavier form stacks stay product-specific. The template
ships the toolchain and the architectural spine.

## Tech Stack (April 2026)

| Layer          | Choice                                                               | Version                    |
| -------------- | -------------------------------------------------------------------- | -------------------------- |
| Runtime        | React Native                                                         | 0.83 (Expo SDK 55)         |
| Framework      | Expo                                                                 | 55 (stable since Jan 2026) |
| Language       | TypeScript                                                           | 5.9 strict                 |
| Bundler        | Metro                                                                | bundled with Expo          |
| Routing        | Expo Router                                                          | v55                        |
| Styling        | NativeWind + Tailwind                                                | 4.2 + 3.4                  |
| Icons          | @expo/vector-icons                                                   | ships with Expo            |
| State          | Zustand + devtools + persist                                         | 5                          |
| Server state   | TanStack Query (+ AppState focus)                                    | 5                          |
| Env validation | @t3-oss/env-core + zod                                               | 0.13 / 4                   |
| Animation      | react-native-reanimated (+ worklets)                                 | 4.2 / 0.7.4                |
| Gestures       | react-native-gesture-handler                                         | 2.30                       |
| Storage        | expo-secure-store (secrets) + AsyncStorage (cache)                   | —                          |
| Observability  | stub `logger.ts` (wire Sentry/etc in product)                        | —                          |
| Testing        | Jest + jest-expo + @testing-library/react-native (built-in matchers) | —                          |
| Linting        | ESLint 9 flat + eslint-config-expo + import-x + oxlint pre-pass      | —                          |
| Formatting     | Prettier                                                             | 3                          |
| Git hooks      | Husky + commitlint + lint-staged                                     | —                          |
| Compiler       | React Compiler (enabled via `experiments.reactCompiler`)             | stable                     |
| i18n           | i18next + react-i18next + `src/shared/locales/` + expo-localization  | typed `t()` keys           |
| Forms          | react-hook-form + @hookform/resolvers (Zod)                          | simple inputs default      |

`expo-localization` supplies the initial language; catalogs live next to the app
in JSON (see `MAP.md` → i18n).

## Architecture

**Shipped under `src/` today:** `app/` (Expo Router: root layout with i18n gate,
`RootStack`, tab group, home and settings tabs, not-found), `shared/locales/` +
`shared/lib/i18n/` (bundled translations + init), `lib/` (query client with
AppState focus, logger stub, `secureToken` for Keychain-backed auth token I/O, `cn()` helper and their tests), `store/user` and
`store/utils` (example Zustand + persist + selector helpers), `test/setup.ts` for
Jest, and `env.ts` for validated public env.

**Extension points (add when the product needs them):** `components/` (shared
UI, layout shells, primitives), `hooks/<domain>/` (feature hooks colocated with
tests), theme hooks if you introduce a design-system-level theme provider.

### Expo Router (file-based)

- Route groups: `(tabs)` → tabs, no URL segment
- Typed routes: `experiments.typedRoutes: true` generates type-safe `href`
- Deep links: `scheme: 'templatern'` in `app.config.ts` → `templatern://` URLs (align with your product scheme before shipping)
- Root layout wraps providers once; subsequent layouts compose

### NativeWind (className-first)

Prefer utility classes on native primitives over `StyleSheet.create` unless
inline dynamic styles are required. Dark mode is driven by `.dark` on the root
with `useColorScheme` / NativeWind color scheme APIs. Web-only modifiers such as
`hover:` do not apply on native; use press/active patterns instead.

### Stores: Zustand + createSelectors

Selectors are composed via the `createSelectors` helper so call sites can use
fine-grained subscriptions. Tokens belong in `expo-secure-store`, not in
Zustand `persist` / AsyncStorage; the sample user store uses `partialize` for
non-sensitive fields only.

### TanStack Query: AppState focus

Native apps do not emit `window focus`. `src/lib/queryClient.ts` wires
`AppState` to the query focus manager so refetch behavior matches returning to
the foreground.

### Env: fail fast

Import the validated `env` object from `@/env`; missing or malformed
`EXPO_PUBLIC_*` values throw before first render.

### Logger

Avoid raw `console.error` for product-level diagnostics; use the stable
`logger.*` API in `src/lib/logger.ts` so a future Sentry or Datadog adapter can
plug in without rewiring call sites. The default stub reduces noise in
production builds.

### React Compiler (auto-memoization)

Enabled via `experiments.reactCompiler: true` in `app.config.ts`. Most manual
memoization becomes unnecessary; if a component misbehaves under compilation,
opt out with the compiler’s escape hatch directive documented in React 19
release notes.

### Path alias `@/*`

Single source of truth: `tsconfig.json` `paths`. Metro reads this directly in
SDK 55, no Babel plugin needed.

## Dev Tooling

- `npm start` — Expo dev server (QR → Expo Go / Dev Client)
- `npm run ios` / `npm run android` — simulator / emulator
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint flat
- `npm run lint:oxlint` — fast pre-pass (Rust-based, `src` scope)
- `npm run test` — Jest
- `npm run ci:local` — typecheck → oxlint → eslint → format:check → test:coverage → expo-doctor
- `npm run perf:*` — optional Hermes bundle export + metric capture against `scripts/perf-baseline.json` (see `scripts/perf-program.md`)
- `npx expo prebuild --clean` — regenerate `ios/` and `android/` from config
- `eas build` — cloud build (no Mac required for iOS)
- `eas update` — OTA JS/asset push (no App Store review)

## Non-goals for template

- Web support (dropped — `app.config.ts` has no web block)
- E2E tests (wire Maestro / Detox per product)
- Remote-only translation delivery (Phrase/Lokalise HTTP backend, etc.) without JSON in-repo
- TanStack Form or heavy form codegen as the default abstraction (template uses RHF + Zod resolvers for typical inputs)
- Crash reporting (wire Sentry/Bugsnag per product into `logger.ts`)
- Auth (pick Clerk/Supabase/Auth0/Firebase per product)
