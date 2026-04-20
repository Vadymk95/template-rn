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

**Shipped under `src/` today:** `app/` (Expo Router root layout with i18n + store
hydration gate, `RootStack`, tabs, not-found), `widgets/todo-workspace` (home
screen composition), `features/todo-*` and `features/todo` (workspace actions,
dialogs, filtering, and derived logic), `store/todo` + `store/user` + `store/utils`
(Zustand slices and selector helpers), `shared/ui/` (cross-app UI primitives),
`shared/lib/theme/` (tokenized spacing/color/typography), `shared/locales/` +
`shared/lib/i18n/` (bundled translations + init), `lib/` (query client with AppState
focus, logger stub, `secureToken`, utility helpers), `test/setup.ts`, and `env.ts`.

**Extension points (add when the product needs them):** API clients per feature,
offline query persistence (`NetInfo` + `persistQueryClient`), product auth provider,
and vendor observability adapter behind `logger.ts`.

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

### TanStack Query: AppState focus + extension points

**Currently wired:** `src/lib/queryClient.ts` wires `AppState` → `focusManager`
so queries refetch on foreground return (native apps do not emit `window focus`).
Default `staleTime: 60s`, `gcTime: 5min`, retry skips 4xx errors. The
`QueryClientProvider` is mounted in `src/app/_layout.tsx`.

**Not yet wired (add when the product has real API calls):**

| What                                                                                  | Why                                                                                                                 | Where                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `networkMode: 'offlineFirst'` + `onlineManager` via `@react-native-community/netinfo` | Default `'online'` mode on mobile with spotty signal looks like a broken app                                        | `src/lib/queryClient.ts` defaultOptions |
| Query key factory per feature                                                         | Prefix-based invalidation; `queryOptions()` gives type-safe `getQueryData` without generics                         | `src/features/<name>/api/<name>Keys.ts` |
| `persistQueryClient` with `shouldDehydrateQuery` whitelist                            | Offline reads between sessions; whitelist only "important" queries (profile, settings), never search/infinite lists | new `src/lib/queryPersist.ts`           |

**Hard rule:** server state goes in TanStack Query, client/UI state goes in
Zustand. Never copy API response data into a Zustand store — that creates a
second source of truth and invalidation bugs.

See `src/lib/queryClient.ts` for inline code snippets of each extension point.

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
- Full E2E stack in CI (a local Maestro smoke skeleton may exist, but CI-grade E2E remains product-specific)
- Remote-only translation delivery (Phrase/Lokalise HTTP backend, etc.) without JSON in-repo
- TanStack Form or heavy form codegen as the default abstraction (template uses RHF + Zod resolvers for typical inputs)
- Crash reporting (wire Sentry/Bugsnag per product into `logger.ts`)
- Auth (pick Clerk/Supabase/Auth0/Firebase per product)

## Full scope: strengths vs deferred tools (when to adopt)

This section is the **single narrative** for “what we optimize for” vs “what stays out until the product needs it.” Per-item tiering and Adopt/Defer flags live in `DECISIONS.md` (audit backlog).

### Where the scaffold is intentionally strong

- **Compliance defaults** — iOS privacy manifest (required-reason APIs), least-privilege permissions (empty until a feature needs them), CI `contents: read` on workflows.
- **Type safety** — strict TS with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and type-aware ESLint on `src/**`.
- **Lint pipeline** — Oxlint pre-pass, ESLint as source of truth, FSD boundaries, `i18next/no-literal-string` on routes.
- **React Compiler** enabled by default in `app.config.ts` (escape hatches when needed).
- **Secrets hygiene** — auth token via `expo-secure-store` (`src/lib/secureToken.ts`), not AsyncStorage; Zustand persist only for non-sensitive fields.

### What is deferred and typical adoption triggers

| Area                                 | Deferred in-repo                                  | When to add                                                                                       |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **MMKV / sync KV**                   | AsyncStorage + Jest mock                          | Measured slow hydration, sync read before first paint, Zustand/Query persist with strict perf SLA |
| **Sentry / crash + source maps**     | `logger` stub + optional `EXPO_PUBLIC_SENTRY_DSN` | Production crash visibility, release health, or org requires upload in CI                         |
| **Maestro (or Detox) E2E**           | Jest + manual smoke                               | First release candidate, regression policy on critical flows, or post–EAS Update smoke            |
| **expo-image**                       | Plain `Image` / no image                          | Remote images, caching, placeholders, CDN                                                         |
| **FlashList**                        | `FlatList` / short lists                          | Long virtualized lists, scroll jank                                                               |
| **TanStack Query persist + NetInfo** | Foreground refetch only                           | Offline-first product requirement                                                                 |
| **SHA-pinned Actions / gitleaks**    | Floating `@v4` + `permissions`                    | Org supply-chain policy, public org template                                                      |
| **HTTP client layer**                | `fetch` + Query                                   | Auth refresh, uniform error taxonomy, interceptors                                                |

### Comparison to opinionated product starters

Some public starters (e.g. **Obytes**-style) ship **MMKV, Sentry, Maestro**, and more **out of the box** — faster path to a “batteries included” product, at the cost of vendor choices and extra native/CI surface. **template-rn** stays **vendor-free** by default: stricter types, compliance baselines, and Oxlint/FSD are in-repo; runtime observability and native perf stores are **fork decisions** once requirements exist. Neither approach is universally “better” — they optimize for different first steps.
