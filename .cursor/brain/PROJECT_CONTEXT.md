# template-rn — Project Context

## Purpose

Production-ready React Native + Expo foundation, the mobile sibling of `template-1` (React SPA): strict types, validated env, a declarative pipeline, adapted for file-based routing, native dependencies via config plugins, OTA updates and cloud builds.

A **generic MVP template**: no vendor auth, analytics or crash reporting; wire those when the product needs them. It ships the toolchain and the architectural spine.

## Tech Stack (July 2026)

The one place for the stack. Exact versions are `package.json`; every package held below a newer release is in `scripts/version-holds.json`.

- **Runtime**: React Native 0.86 on Expo SDK 57, React 19.2, TypeScript 6.0 strict, Metro (bundled with Expo), React Compiler (`experiments.reactCompiler`).
- **Routing and styling**: Expo Router v57; NativeWind 4.2 on Tailwind 3.4; `@expo/vector-icons` (ships with Expo); Reanimated 4 with worklets; gesture-handler.
- **State and data**: Zustand 5 (devtools + persist); TanStack Query 5 with AppState focus; `@t3-oss/env-core` + Zod for env; `expo-secure-store` for secrets, AsyncStorage for cache.
- **i18n and forms**: i18next + react-i18next, typed `t()` keys, bundled JSON in `src/shared/locales/`, expo-localization; react-hook-form + `@hookform/resolvers` (Zod).
- **Quality**: Jest + jest-expo + `@testing-library/react-native` (built-in matchers); ESLint 10 flat + eslint-config-expo + import-x behind an oxlint pre-pass; Prettier 3; Husky + commitlint + lint-staged.
- **Observability**: stub `logger.ts`; wire Sentry or similar in the product.

## Architecture

**Shipped under `src/`**: `app/` (root layout with the i18n and store hydration gate, `_RootStack`, tabs, not-found), the `widgets/` + `features/` + `store/` slices of the start guide and the todo sample, `shared/` (ui primitives, tokenized theme, locales and i18n init), `lib/` (query client with AppState focus, logger stub, `secureToken`), `test/setup.ts` and `env.ts`. File map: `MAP.md`; layer rules: `.cursor/rules/fsd-layers.mdc`.

**Extension points** (add when the product needs them): API clients per feature, offline query persistence, a product auth provider, a vendor observability adapter behind `logger.ts`. Recipes: `EXTENSIONS.md`.

### Expo Router (file-based)

- Route groups: `(tabs)` → tabs, no URL segment. Typed routes (`experiments.typedRoutes: true`) generate type-safe `href`.
- Deep links: `scheme: 'templatern'` in `app.config.ts`; align it with your product scheme before shipping.
- The root layout wraps providers once; subsequent layouts compose.

### TanStack Query: AppState focus + extension points

**Wired:** `src/lib/queryClient.ts` maps `AppState` to `focusManager`, so queries refetch on foreground return (native apps emit no `window focus`). Defaults: `staleTime` 60 s, `gcTime` 5 min, retry skips 4xx. `QueryClientProvider` is mounted in `src/app/_layout.tsx`.

**Not yet wired** (add when the product has real API calls; inline snippets in `src/lib/queryClient.ts`):

- `networkMode: 'offlineFirst'` + `onlineManager` via `@react-native-community/netinfo`: the default `'online'` mode looks like a broken app on spotty mobile signal.
- A query key factory per feature (`src/features/<name>/api/<name>Keys.ts`): prefix invalidation, and `queryOptions()` gives type-safe `getQueryData`.
- `persistQueryClient` with a `shouldDehydrateQuery` whitelist: offline reads between sessions for "important" queries (profile, settings), never search or infinite lists.

**Hard rule:** server state in TanStack Query, client/UI state in Zustand; never copy API response data into a store (a second source of truth).

## Commands

The gate, its moments and its scripts: `AGENTS.md` § Commands / the gate is the only definition. Stage timings: `VERIFICATION.md`. Every script: `package.json` and the README command tables. Native: `npx expo prebuild --clean` regenerates `ios/` and `android/`; `eas build` / `eas update`: README § Build profiles. Bundle metrics: `npm run perf:*` against `scripts/perf-baseline.json` (`scripts/perf-program.md`).

## Non-goals for template

- Web support (dropped; `app.config.ts` has no web block)
- Full E2E stack in CI (a local Maestro smoke skeleton exists; CI-grade E2E stays product-specific)
- Remote-only translation delivery (Phrase/Lokalise HTTP backend) without JSON in-repo
- TanStack Form or heavy form codegen as the default (RHF + Zod resolvers for typical inputs)
- Crash reporting (wire Sentry/Bugsnag per product into `logger.ts`)
- Auth (pick Clerk/Supabase/Auth0/Firebase per product)

## Full scope: strengths vs deferred tools (when to adopt)

The single narrative for what we optimize for versus what stays out until the product needs it. The decision record is `DECISIONS.md`; the guard behind each strength is named there.

**Strong by default:** compliance (iOS privacy manifest, empty permissions until a feature needs them, `contents: read` workflow tokens, SHA-pinned actions, zizmor, the cleartext-traffic guard); strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, type-aware ESLint on `src/**`); the lint pipeline (oxlint pre-pass, ESLint as source of truth, FSD boundaries, `i18next/no-literal-string` on routes); the React Compiler; secrets hygiene (`expo-secure-store` via `src/lib/secureToken.ts`, Zustand persist for non-sensitive fields only).

**Deferred, with the trigger that adopts each:**

- **MMKV / sync KV** (now AsyncStorage + Jest mock): measured slow hydration, a sync read before first paint, or a strict persist perf SLA.
- **Sentry / crash + source maps** (now the `logger` stub + optional `EXPO_PUBLIC_SENTRY_DSN`): production crash visibility, release health, or CI upload required.
- **Maestro (or Detox) E2E in CI** (now local flows in `.maestro/`, `npm run maestro`): a regression policy on critical flows, a first release candidate, or a post-EAS-Update smoke.
- **expo-image**: remote images, caching, placeholders, CDN. **FlashList**: long virtualized lists, scroll jank.
- **TanStack Query persist + NetInfo** (now foreground refetch only): an offline-first requirement. **HTTP client layer** (now `fetch` + Query): auth refresh, a uniform error taxonomy, interceptors.
- **keyboard-controller**: forms hit keyboard overlap. **Notifications, universal links**: product and domain decisions.
- **Preview EAS builds per PR**: the cost and the EAS secrets in CI are accepted. **actions/cache for npm and Metro**: CI runtime hurts.
- **Storybook RN, jailbreak detection**: a design-system team; a finance or high-assurance product. **tailwind-variants / CVA**: a second styling abstraction is justified.
