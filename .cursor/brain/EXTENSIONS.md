# Extensions — graduating template → MVP / personal project

This file is the **single source of truth** for "what to add when forking this template into a real product". The template ships without the libraries a typical app needs on day one (a backend client wiring, SVG icons, device info, crash reporting, push, offline persistence) because unused dependencies cost audit surface, native build time and review attention. Each phase below says when to add a capability, the exact install, where it plugs in, a professional default with the reason for every value, the guard to add with it, the security note and what not to do.

Companion docs: [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (the stack you extend, and the tables of what is not wired yet), [`SKELETONS.md`](./SKELETONS.md) (danger zones), [`VERIFICATION.md`](./VERIFICATION.md) (native parity and OTA discipline), [`DECISIONS.md`](./DECISIONS.md) (why each tool was kept or removed), [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md), `AGENTS.md` (rules and the gate), `docs/template-reset.md` (fork identity).

**How to read a recipe.** Every recipe lists a doc source for its commands and config keys. The stack is Expo SDK 57 with React Native 0.86: a recipe that targets a newer SDK says so, and nothing here assumes a newer API. An item marked **(unverified)** was not confirmed against the vendor docs when this file was written; confirm it on the page named in the recipe before relying on it. An item marked **(opinion)** is a recommendation with no vendor source.

**Priority order when the fork becomes a real product** (the phases are the detail): the HTTP layer and its retry rules (Phase 1) → auth on `<Stack.Protected>` plus the token rules (Phase 2) → crash reporting through the existing `logger.ts` plug-in point (Phase 3) → build-profile environments and the OTA path (Phase 5) → offline persistence only when the product needs it (Phase 4) → push and deep links (Phase 6) → UI extras as screens demand them (Phase 7).

---

## Rules every recipe inherits (one home, linked, not restated)

- **A native dependency or native config change** needs a dev-client rebuild and a `version` bump so `runtimeVersion` changes: [`VERIFICATION.md`](./VERIFICATION.md) § OTA discipline. Install Expo and native packages with `npx expo install <name>` (it picks the version for the installed SDK); a plain `npm install` of such a package ignores the SDK list (`AGENTS.md` § Version holds). A brand-new release is held back by the dependency cooldown (`AGENTS.md` § Commands / the gate › Bootstrap after clone).
- **A new `plugins` entry in `app.config.ts`** needs `npx expo prebuild --clean` ([`SKELETONS.md`](./SKELETONS.md)); never hand-edit `ios/` or `android/`.
- **A new native module needs a Jest mock** in `src/test/setup.ts` (or a `transformIgnorePatterns` entry in `package.json` when the package ships untranspiled source), otherwise every suite that imports it fails.
- **Every staged `src/**` logic file needs a co-located test** (the pre-commit sibling gate; the exempt paths, `src/app/**` among them, are listed in `scripts/check-test-siblings.mjs`). Write the guard named in the recipe in the same commit as the code, including for an exempt file.
- **Layer law:** `src/app/**` may not import `src/store/**` (`eslint.config.mjs`, the `boundaries/dependencies` block). A route or layout reads store state through a hook under `src/hooks/` or `src/features/`, as `src/app/_layout.tsx` does with `useStoreReady`.
- **A new env var** goes in `.env.example`, the Zod schema in `src/env.ts` and its `runtimeEnv` mirror; restart Metro. `EXPO_PUBLIC_*` values are inlined into the bundle and readable by anyone with the app: nothing secret ever goes there.
- **Docs in the same PR:** see "Cross-references" at the end.
- **Run `npm run doctor`** (expo-doctor, advisory) after adding a native package. The by-hand prohibition on the full gate in `AGENTS.md` still applies.

---

## Phase 0 — Fork identity (before the first store build)

Bundle ids, display names, slug, deep-link scheme, assets, EAS and legal text are listed in `docs/template-reset.md`. Do not duplicate that list here. Two things this guide depends on:

- **Choose `scheme` in `app.config.ts` once.** Every deep link, OAuth redirect and QR code ever issued carries it; changing it later breaks all of them (Phase 6).
- **Set `EAS_PROJECT_ID`** before the first EAS build. `app.config.ts` copies it into `extra.eas.projectId` and `updates.url`; push tokens (Phase 6) and OTA (Phase 5) both read that project id.

---

## Phase 1 — A real backend: the HTTP layer and TanStack Query

TanStack Query, Zod and `safeFetch` ship wired, but with no real API behind them. The seed is `src/lib/api/_exampleSafeQuery.ts`; the client defaults and the four extension points are in `src/lib/queryClient.ts` and [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) § "TanStack Query: AppState focus + extension points". Read both before changing anything.

**Doc sources:** TanStack Query docs, [`queryOptions`](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) and the `useQuery` option reference (checked via context7: `retry` defaults to 3 on the client, `retryDelay` is exponential backoff capped at 30 seconds, `staleTime` defaults to 0).

### 1.1 HTTP errors and the retry rule

- **Trigger:** the first real endpoint.
- **Install:** nothing.
- **Where it plugs in:** shipped. `src/lib/api/safeFetch.ts` throws `HttpError` (a numeric `status`, the request `url`, and the message `HTTP <status> <statusText> (<url>)`) for every non-2xx response, and the retry predicate in `src/lib/queryClient.ts` skips retries for 4xx because `error.status` is a number. Extend `HttpError` when your API returns an error body worth keeping; do not add a second HTTP error class. `SchemaValidationError` stays separate.
- **Config and why:**
    - Keep the predicate: no retry on 4xx (the request itself is wrong and repeating it only spends battery), at most 2 retries otherwise. The library default is 3 retries; the template lowers it for mobile latency (opinion).
    - Treat `SchemaValidationError` as non-retryable (opinion): a response that violates the contract will violate it again, and retrying only delays the error report. Not shipped: the predicate retries it twice today, because it carries no `status`.
    - Leave `retryDelay` at the library default.
- **Guard:** shipped in `src/lib/api/safeFetch.test.ts` (`safeFetchQueryFn through the default retry rule`): a real `QueryClient` built from the app's default options fetches a 404 once and a 503 three times. Without it, `safeFetch` can regress to a plain `Error` and the 4xx rule silently stops working. When you add the `SchemaValidationError` rule, add its case beside these two.
- **Security:** the current message embeds the full URL. A query string with a token or an email would then reach the crash reporter (Phase 3). Build the message from origin and path only (opinion).
- **Do NOT:** catch and swallow errors inside a `queryFn` (the query never enters its error state), or retry non-idempotent mutations by default (the `useMutation` `retry` option defaults to `0`: TanStack `UseMutationOptions` reference, checked via context7).

### 1.2 Timeout and cancellation

- **Trigger:** the first endpoint a user waits on.
- **Install:** nothing.
- **Where it plugs in:** `safeFetchQueryFn` already forwards TanStack's `signal` and re-throws `AbortError` untouched. Add a request timeout inside `safeFetch`: an `AbortController` aborted by a `setTimeout`, chained to the incoming signal, cleared in `finally`.
- **Config and why:** one named constant (`no-magic-numbers` is on), 15 seconds as a starting point (opinion): long enough for a slow mobile network, short enough that a stalled request stops holding a spinner.
- **Timeout is not cancellation.** Aborting the controller makes `fetch` reject with an `AbortError`, and `safeFetchQueryFn` passes every `AbortError` through as cancellation. When the timer fired, throw a distinct `TimeoutError` instead (checked on a local flag, not on the error name), so the query enters its error state and the retry predicate treats it as a transport failure. Only an abort that came from the incoming signal stays an `AbortError`.
- **Guard:** a fake-timers test: a request that never resolves rejects with `TimeoutError` after the constant; an already-aborted incoming signal rejects with `AbortError` immediately; the timer is cleared after success.
- **Security:** none specific.
- **Do NOT:** rely on a platform default timeout (React Native `fetch` documents none that this file could confirm). Do not reach for `AbortSignal.timeout` or `AbortSignal.any`: their availability on this Hermes version is **(unverified)**.

### 1.3 Query keys, `queryOptions` and mutations per feature

- **Trigger:** the second query in a feature (the first one can live inline).
- **Install:** nothing.
- **Where it plugs in:** `src/features/<name>/api/<name>Keys.ts` holds a key factory (`all`, `lists`, `detail(id)`), and `queryOptions()` builders next to it so the same options serve `useQuery`, prefetching and `setQueryData` with full type inference. Features import downward only: `src/store` (entities), `src/lib` and `src/shared` (`.cursor/rules/fsd-layers.mdc`). Response schemas live in the same folder and go through `safeFetchQueryFn(url, schema)`, so contract drift fails loudly at the edge.
- **Config and why:**
    - Hierarchical keys (`[feature, scope, params]`) so one `invalidateQueries({ queryKey: [feature] })` after a mutation hits every list and detail of that feature.
    - Override `staleTime` per query where data changes slower or faster than the one-minute default (reference data: long; a live feed: short).
    - Mutations: invalidate the feature key in `onSuccess`; use optimistic updates (`onMutate`, rollback in `onError`) only for actions where instant feedback matters. The pattern is from the TanStack docs and was not re-checked here.
- **Guard:** a test per hook rendered with a fresh `QueryClient` whose `retry` is off, so one test never inherits another's cache. Add the key factory to the colocated tests so a renamed key breaks a test, not a screen.
- **Do NOT:** copy server data into Zustand. Server state lives in TanStack Query, client state in Zustand (the fourth extension point in `PROJECT_CONTEXT.md`).

### 1.4 The API base URL per build profile

- **Trigger:** the first non-local environment (a staging or production backend).
- **Install:** nothing.
- **Where it plugs in:** `EXPO_PUBLIC_API_URL` is already required (`z.url()`) in `src/env.ts`. Per-environment values go in EAS environment variables (Phase 5.1), with each build profile in `eas.json` naming its EAS environment through the `environment` field. Do not put this URL in a build profile's `env` object: `eas update` does not read build profiles, it reads only the EAS environment passed with `--environment` (EAS environment variables docs), so an OTA bundle would be built with a different URL than the binary, or with none, and the Zod check in `src/env.ts` then throws at start-up on every device that takes the update. Local development uses `.env`.
- **Config and why:** a production profile must use an `https` URL. A cleartext `http` dev server needs an explicit allowance: `scripts/native-config.test.mjs` fails on cleartext-HTTP keys in `app.config.ts` and `plugins/`, and the reasoned exceptions live in `scripts/native-config-allowlist.json` (empty today). Read that test before adding an entry, and add the reason with it.
- **Guard:** the existing native-config test (part of `npm run test:scripts`). The EAS environment is the only place the staging and production URLs differ; the preview-channel check in 5.2 is what proves an OTA bundle got the right one.
- **Security:** the URL is public by construction. Never place an API key, a client secret or a signing key in an `EXPO_PUBLIC_*` variable.
- **Do NOT:** read `process.env` directly (`AGENTS.md` § Critical rules: Env), or hardcode the URL in a feature.

---

## Phase 2 — Auth and secure storage

The template ships the storage half: `src/lib/secureToken.ts` (`setAuthToken` / `getAuthToken` / `clearAuthToken`) over `expo-secure-store`, keyed by `SECURE_STORAGE_KEYS` in `src/lib/storageKeys.ts`, and the rule that tokens never go to AsyncStorage or a persisted Zustand store (`AGENTS.md` § Critical rules: Stores). It ships no login flow, no route guard and no token injection.

### 2.1 Token storage options

- **Trigger:** the first real session token.
- **Install:** nothing (`expo-secure-store` is a dependency and a plugin).
- **Where it plugs in:** `src/lib/secureToken.ts`.
- **Config and why:**
    - Pass `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` on `setItemAsync` for session tokens (the constant exists in the library source; the recommendation is opinion): the token is readable only while the device is unlocked and is not carried to another device through a backup.
    - `requireAuthentication: true` asks for biometrics or the passcode on every read. Use it for a high-risk secret only, never for a token read on every request. The docs say to test it on a real device. The `expo-secure-store` plugin takes a `faceIDPermission` string for the iOS usage text.
    - The `expo-secure-store` plugin option `configureAndroidBackup` defaults to true and excludes SecureStore data from Android Auto Backup, so a restored phone does not receive undecryptable entries. Keep the default.
    - Values are strings. Expo enforces no size limit, but the docs warn that some iOS releases refused values above roughly 2048 bytes: store the token, never a profile object, and handle the native error from `setItemAsync`.
    - The Jest mock in `src/test/setup.ts` exports only the three functions. Add the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` constant to it when you pass the option, or a test that asserts the options sees `undefined`.
    - A key rename in `SECURE_STORAGE_KEYS` is a storage schema change: the old entry is orphaned and every user is logged out. Decide on migration before renaming.
- **Guard:** the existing `expo-secure-store` Jest mock in `src/test/setup.ts`; a test that `clearAuthToken()` runs on logout and on a failed refresh (2.3).
- **Security:** on iOS, `expo-secure-store` data can persist across an uninstall when the app is reinstalled with the same bundle id; on Android it does not (secure-store docs, SDK 57). On the first launch after an install, call `clearAuthToken()` before trusting a stored token, keyed on an AsyncStorage flag, which an uninstall does remove (opinion).
- **Do NOT:** put a token in AsyncStorage, Zustand `persist`, a query key, a log line, the crash reporter's context or any `EXPO_PUBLIC_*` variable.
- **Doc source:** [`expo-secure-store` for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/securestore).

### 2.2 Route protection with `Stack.Protected`

- **Trigger:** the first screen that needs a signed-in user.
- **Install:** nothing (Expo Router ships it).
- **Where it plugs in:** `src/app/_RootStack.tsx` renders the root `<Stack>`. Wrap the signed-in screens in `<Stack.Protected guard={isSignedIn}>` and the sign-in screen in a guard with the opposite value; Expo Router redirects when the guard flips. The auth state already lives in `useUserStore` (`src/store/user/userStore.ts`: `username`, `setUser`, `logout`); extend it instead of adding a second auth store. `_RootStack.tsx` is in the app layer, which lint forbids from importing a store, so expose the flag through a hook under `src/hooks/` (the pattern of `useStoreReady`).
- **Config and why:** evaluate the guard only after hydration. `src/app/_layout.tsx` already holds the splash screen until `useStoreReady()` is true; keep the stack from rendering before the stored token has also been validated, or a signed-in user flashes the sign-in screen. "A token exists" is not "the user is signed in": validate it with one cheap authenticated call at boot and clear it on a 401 (opinion).
- **Guard:** a unit test on the hook (signed out → false, hydrating → not rendered). The `expo-router` mock in `src/test/setup.ts` defines `Stack` as a plain function with no `Protected` member, so a test that renders `RootStack` needs that mock extended first. A Maestro flow beside `.maestro/smoke.yaml` for sign in → protected screen → sign out → sign-in screen (the only layer that sees real navigation).
- **Security:** a client guard is UX, not authorization. The backend must reject every unauthorised request on its own.
- **Do NOT:** use the `redirectTo` option of `Stack.Protected` (documented for SDK 58 and later, newer than this repo's SDK 57), or gate screens with a `useEffect` + `router.replace` (a flash of protected content first).
- **Doc source:** [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected).

### 2.3 Token injection, 401 and refresh

- **Trigger:** the first endpoint that needs a token.
- **Install:** nothing.
- **Where it plugs in:** the fetch wrapper from Phase 1. Read the token with `getAuthToken()` and set `Authorization: Bearer …` only when the request URL's origin equals the origin of `EXPO_PUBLIC_API_URL`.
- **Config and why:**
    - On 401, run **one** refresh shared by every request in flight (a single promise), then retry the original request once. Parallel 401s otherwise fire several refreshes, and a rotating refresh token invalidates itself (opinion).
    - If the refresh fails: call `useUserStore`'s `logout()` (it already runs `clearAuthToken()` and resets `username`), then `queryClient.clear()`, so the next account on this device never sees the previous account's cache. Extend `logout()` if new auth state is added, rather than clearing pieces from each call site.
    - A logged-out user must also drop any persisted query cache (Phase 4).
- **Guard:** tests that two simultaneous 401s call refresh once; that the header is absent for a foreign origin; that a failed refresh clears the token, the store and the cache.
- **Security:** never attach the token to third-party URLs (image CDNs, analytics endpoints). Keep headers out of the logger's context.
- **Do NOT:** loop on a 401 from the refresh endpoint itself, or store the refresh token anywhere except `expo-secure-store`.
- **Social or OAuth sign-in** (`expo-auth-session`, `expo-web-browser`, a vendor SDK) was not researched for this file: read its Expo docs page first, and note that its redirect URI uses the scheme from Phase 0.

---

## Phase 3 — Observability: crash reporting, device and app info, analytics

### 3.1 Crash reporting (Sentry)

- **Trigger:** the first build that reaches testers outside the dev team. Without a reporter, a native crash on a tester's phone leaves no trace.
- **Install:** `npx expo install @sentry/react-native` (the manual-setup line in the Sentry Expo guide; the wizard is the alternative there, but it edits files this guide wires by hand).
- **Where it plugs in:**
    - `src/lib/logger.ts` already defines the seam: `report.breadcrumb(level, message, data)` and `report.capture(error, context)` are no-ops with a `TODO(observability)`. `logger.warn` and production `logger.info` call the first, `logger.error` the second, and the route `ErrorBoundary` (`src/shared/ui/ErrorBoundary/ErrorBoundary.tsx`) already reports through `logger.error`. Implement the two functions with `Sentry.addBreadcrumb` and `Sentry.captureException` (Sentry React Native breadcrumbs and usage pages) and no call site changes.
    - Initialise with `Sentry.init` once in `src/app/_layout.tsx` at module scope, and export the root as `Sentry.wrap(...)`. `EXPO_PUBLIC_SENTRY_DSN` already exists as an optional string in `src/env.ts`: skip `init` when it is empty so local runs stay silent. A DSN is a public identifier, not a secret.
    - Metro: `metro.config.js` builds its config with `getDefaultConfig(__dirname)` from `expo/metro-config` and wraps the result in `withNativeWind`. Replace that call with `getSentryExpoConfig(__dirname)` from `@sentry/react-native/metro` (the Sentry Expo guide's form; it builds on Expo's default config and adds the debug ids that tie source maps to bundles). Keep the existing `resolveRequest` override and keep `withNativeWind` outermost (opinion).
    - Config plugin: the guide says `npx expo install` adds the plugin to the `plugins` array, which it can only do in a static config; `app.config.ts` is dynamic, so expect to add it yourself (inference). Add `['@sentry/react-native/expo', { url, organization, project }]` to `plugins` by hand, or wrap the exported config in `withSentry` from the same path (both forms are in the Sentry Expo guide). The plugin has a `useNativeInit` option that starts Sentry natively before JavaScript loads so start-up crashes are captured.
- **Config and why:**
    - `environment` from `env.EXPO_PUBLIC_ENV`, and `release` / `dist` matching the source-map upload exactly (the SDK sample says a mismatch makes the source maps useless).
    - `tracesSampleRate`: the docs use `1.0` as a sample and say to adjust it for production. Start low (for example 0.1, opinion) and raise only while measuring the quota. The same applies to profile and replay sample rates.
    - A `beforeSend` callback exists as a JavaScript-only hook (it is not sent to the native layer): use it to drop or scrub events that carry an email, a token or a request body.
    - Leave `sendDefaultPii` at its default, `false` (Sentry React Native options reference). The guide's `Sentry.init` sample sets it to `true`, which adds data such as the IP address and user to events: do not copy that line.
    - Source maps for store builds are uploaded at build time by the plugin and Metro config using `SENTRY_AUTH_TOKEN`: set it as a **secret** EAS variable, never as `EXPO_PUBLIC_*`, and never as the plugin's `authToken` option (the plugin itself warns that this is insecure).
    - Source maps for OTA updates are **not** uploaded automatically. After every `eas update`, run `npx @sentry/expo-upload-sourcemaps dist` with `SENTRY_AUTH_TOKEN` set in the shell (that package needs `@sentry/react-native` 8.9.0 or later; older versions use `npx --package=@sentry/react-native sentry-expo-upload-sourcemaps dist`). A secret EAS variable is not readable during `eas update` (5.1), so the token comes from the local environment or the CI secret store. Skip this and every crash from an OTA bundle arrives unsymbolicated.
- **Guard:** a unit test that `report.capture` and `report.breadcrumb` forward to the SDK mock and do not throw when the DSN is absent; a test that the scrubber removes a `token` field and an email-shaped string. Add a Jest mock for `@sentry/react-native` in `src/test/setup.ts`.
- **Security:** crash payloads leave the device. Scrub request URLs (Phase 1.1), headers and form values. A privacy-policy line and the store privacy answers change when a reporter ships (see Phase 3.3 for the iOS manifest).
- **Do NOT:** call the SDK directly from features (use `logger`), let the SDK wrapper replace the route `ErrorBoundary` export in `src/app/_layout.tsx` (keep both), or ship `tracesSampleRate: 1.0` from the docs sample to production.
- **Doc sources:** [Sentry for Expo](https://docs.sentry.io/platforms/react-native/guides/expo), [source maps for Expo](https://docs.sentry.io/platforms/react-native/guides/expo/sourcemaps/uploading/expo), [app start error capture](https://docs.sentry.io/platforms/react-native/guides/expo/manual-setup/app-start-error-capture).
- **Native:** rebuild the dev client, bump `version`, add the plugin, `npx expo prebuild --clean` (rules above).

### 3.2 Device and app info (`expo-device`, `expo-application`)

- **Trigger:** the crash reporter needs tags (phone model, OS version, app build), or an About / support screen shows the version.
- **Install:** `npx expo install expo-device expo-application`.
- **Where it plugs in:** an About screen under a feature, and one tagging call next to the reporter init (3.1). The values are read-only constants.
- **Config and why:**
    - App version for display: `Application.nativeApplicationVersion` and `Application.nativeBuildVersion`.
    - Crash tags: `Device.modelName` and `Device.osVersion`. The equivalent fields on `expo-constants` are deprecated in favour of these packages, so do not reach for `Constants` here.
    - For an OTA-aware About screen, show the update id from `expo-updates` (`useUpdates`, Phase 5) next to the native version: the native version alone does not say which JavaScript bundle is running.
- **Guard:** Jest mocks for both modules in `src/test/setup.ts`; the About screen reads its text through `t()` and its version through one helper that the test can stub.
- **Security:** device model and OS version are low-sensitivity, but a stable device identifier is personal data: do not add one to events or analytics without a consent decision (3.3).
- **Do NOT:** add either package for a single string you can get elsewhere, or log the full device object.
- **Native:** both are native modules: rebuild the dev client and bump `version`.
- **Doc sources:** [`expo-application`](https://docs.expo.dev/versions/v57.0.0/sdk/application), [`expo-device`](https://docs.expo.dev/versions/v57.0.0/sdk/device), and the [`expo-constants` SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/constants), which marks its model, OS-version and build-number fields deprecated in favour of `expo-device` and `expo-application`.

### 3.3 Analytics

- **Trigger:** a product question the crash reporter cannot answer (funnels, retention).
- **Install:** the vendor SDK's Expo install line from its own docs. No vendor is recommended here; the choice depends on hosting and consent needs.
- **Where it plugs in:** one `track(event, props)` function in a new file next to `src/lib/logger.ts`, so features never import a vendor. Events are named constants (`no-magic-strings`), and props are a typed whitelist.
- **Config and why:**
    - Gate every call behind a stored consent flag in AsyncStorage (a preference, not a secret) and send nothing before the user answers where the law requires it (opinion; legal review is yours).
    - App Tracking Transparency (`expo-tracking-transparency`, a real Expo package) is needed only when you track users across other companies' apps or sites; first-party product analytics does not need the prompt (training data, **unverified**).
    - Update the iOS `privacyManifests` block in `app.config.ts` and the store privacy questionnaire with the SDK's declared data types; a vendor that ships its own manifest still has to match your declaration.
- **Guard:** a test that nothing is sent until consent is granted and that revoking consent stops events. Keep the vendor import in that one module so a review can check it.
- **Security:** no PII in event props: no email, no free text, no ids that map back to a person without a hashing decision. Identify users by a pseudonymous id issued by the backend (opinion).
- **Do NOT:** fire events from render, or add two analytics SDKs "to compare".

---

## Phase 4 — Offline: online status and cache persistence

`src/lib/queryClient.ts` names the extension points; `PROJECT_CONTEXT.md` lists what is not wired. This phase turns them on. Do it only when the product needs an app that works with a flaky connection: persistence also persists mistakes.

**Doc sources:** [TanStack Query React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native) and the persist-client plugin docs (checked via context7 in an earlier pass; the wiring below is the documented form).

### 4.1 Online status and `offlineFirst`

- **Trigger:** screens must still show cached data, or mutations must queue, while offline.
- **Install:** `npx expo install @react-native-community/netinfo` (a native module: rebuild and bump `version`). `expo-network` is the Expo-owned alternative; the TanStack guide shows NetInfo, so this file follows it.
- **Where it plugs in:** `src/lib/queryClient.ts`, next to the defaults. Its extension point 1 already holds the `onlineManager.setEventListener` + `NetInfo.addEventListener` snippet from the TanStack React Native guide; register it once at module scope there, not in a component.
- **Config and why:**
    - `networkMode: 'offlineFirst'` on the queries and mutations that should attempt the request once even while the device reports offline and pause further retries until it is back online. The default mode (`online`) does not start the request while offline: the query sits at `fetchStatus: 'paused'`, so a screen keyed on `isPending` alone spins forever in a tunnel. Render cached data and treat `paused` as "offline" in the UI either way.
    - Keep `refetchOnReconnect` at its default: it refetches stale queries when the connection returns.
- **Guard:** a test that flips `onlineManager.setOnline(false)` and asserts the query serves cached data and a mutation is paused, then resumes.
- **Security:** none specific.
- **Do NOT:** treat `isConnected` as proof the backend is reachable; keep real failures flowing to the retry predicate.

### 4.2 Persisting the query cache

- **Trigger:** cold start must show the last known data instantly.
- **Install:** `npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister` (JavaScript-only packages, not in the Expo SDK list; keep both on the same minor as `@tanstack/react-query` in `package.json`, opinion). `@react-native-async-storage/async-storage` is already installed.
- **Where it plugs in:** replace `QueryClientProvider` in `src/app/_layout.tsx` with `PersistQueryClientProvider`, using `createAsyncStoragePersister({ storage: AsyncStorage })` and the same `queryClient`.
- **Config and why:**
    - `gcTime` must be at least `maxAge`, otherwise restored entries are garbage-collected before a screen uses them. `maxAge` defaults to 24 hours; set it deliberately. The persist-client docs say to set `gcTime` on the `QueryClient` itself: restored queries take the client default until a screen observes them, so raising `gcTime` only in a feature's `queryOptions` does not protect them (inference from the docs' wording). Raise the default in `src/lib/queryClient.ts` to at least `maxAge`; the `shouldDehydrateQuery` whitelist below bounds what is kept.
    - `buster`: a string you bump when the cached shape changes (a new app build with a changed schema), so old caches are discarded instead of crashing a screen. Default is an empty string, which never invalidates.
    - `dehydrateOptions.shouldDehydrateQuery`: a whitelist, not "everything". Persist only queries marked in their `meta` (reference data, a feed) and never anything auth-scoped or sensitive. The default persists every successful query.
    - Persisted data sits in AsyncStorage, which is plaintext on disk (`src/lib/storageKeys.ts` says the same): never persist tokens or personal data this way. For encrypted or faster storage see the MMKV row in Phase 7.
- **Guard:** a test that a query without the whitelist `meta` is not dehydrated; a test that logout clears the persisted cache (call `queryClient.clear()` and the persister's `removeClient()`).
- **Security:** a persisted cache outlives the session. Clear it on logout and on a failed refresh (2.3).
- **Do NOT:** persist mutations that include credentials, or bump `maxAge` to "forever" to hide a stale-data bug.

---

## Phase 5 — Release path: environments and over-the-air updates

`app.config.ts` already sets `updates.url` (when `EAS_PROJECT_ID` exists), `runtimeVersion: { policy: 'appVersion' }` and an `extra` block; `eas.json` has `development`, `preview` and `production` build profiles with channels on the last two. The discipline (what may ship OTA, what needs a store build) is [`VERIFICATION.md`](./VERIFICATION.md) § OTA discipline; this phase adds the operating recipe.

**Doc sources:** [EAS environment variables](https://docs.expo.dev/eas/environment-variables), [`eas.json`](https://docs.expo.dev/build/eas-json), [EAS Update](https://docs.expo.dev/eas-update/getting-started), [EAS CLI](https://docs.expo.dev/eas/cli).

### 5.1 Per-profile environments and secrets

- **Trigger:** the first staging build, or the first build-time secret (a source-map upload token).
- **Install:** EAS CLI (`npx eas-cli`); no project dependency.
- **Where it plugs in:** EAS environments (`development`, `preview`, `production`) for every value the JavaScript bundle reads, each with a visibility level (`plaintext`, `sensitive` or `secret`), and an `environment` field on each build profile in `eas.json` that names its environment. A build profile's `env` object is for values only the native build reads (the `APP_VARIANT` already works this way): `eas update` never sees it (1.4).
- **Config and why:**
    - A `EXPO_PUBLIC_*` value cannot be secret whatever its EAS visibility: the bundle inlines it. Secret visibility is for build-time tokens (`SENTRY_AUTH_TOKEN`), not for app configuration.
    - Secrets are not available during `eas update`, so anything an OTA bundle needs at build time must be non-secret.
    - From SDK 55 `eas update` needs an explicit `--environment` so the bundle gets the right variables (the usage page; this repo is on SDK 57).
- **Guard:** keep a single source of truth: a variable defined in `eas.json` is not also defined in an EAS environment. The Zod schema in `src/env.ts` makes a bundle without `EXPO_PUBLIC_API_URL` throw at app start-up, not at build time, and no test covers it today (`src/env.ts` is outside coverage): the preview-channel check in 5.2 is where a missing value shows up.
- **Security:** a leaked secret is rotated, not deleted from history. Never paste values into docs, PRs or chat.
- **Do NOT:** commit `.env` files other than `.env.example`.
- **Command form for setting a variable:** `eas env:set --name <NAME> --value <value> --environment <environment> --visibility plaintext|sensitive|secret` (EAS CLI reference). Never pass a secret value on a command line that lands in shell history; use the interactive form for secrets.

### 5.2 Publishing an OTA update, channels and rollback

- **Trigger:** a JavaScript-only fix that must reach users before the next store release.
- **Install:** nothing (`expo-updates` is already a dependency).
- **Where it plugs in:** the `preview` and `production` channels in `eas.json`; the update URL and runtime version in `app.config.ts`.
- **Config and why:**
    - Publish with `eas update --channel <channel> --message "<what changed>" --environment <environment>`. Always publish to `preview` first and verify on a preview build; `production` second.
    - `runtimeVersion.policy: 'appVersion'` ties an update to the `version` string: any native change needs a bumped `version`, which is exactly the rule in `VERIFICATION.md`. The `fingerprint` policy (a valid value in the SDK 57 config schema) instead changes the runtime version whenever anything that may affect the native runtime changes, at the cost of more builds (EAS Update runtime versions page). Switching policy is a decision for `DECISIONS.md`.
    - Rollback: `eas update:rollback` republishes the update group published before the latest one, or rolls back to the update embedded in the binary when there is none; `eas update:republish` republishes a chosen group (EAS CLI reference). Rehearse a rollback on the `preview` channel before you need it.
    - `updates.checkAutomatically` and `fallbackToCacheTimeout` control launch behaviour. `fallbackToCacheTimeout` defaults to 0 (launch with the cached bundle and apply a downloaded update on the next launch) and accepts 0 to 300000 milliseconds (config source). The default keeps start-up fast; raise it only when users must never run the old bundle, and then keep it short.
    - Check for updates in the foreground with `useUpdates()` or `Updates.checkForUpdateAsync()`, `fetchUpdateAsync()`, `reloadAsync()` (EAS Update docs): prompt the user instead of reloading mid-task.
    - **Code signing:** generate the key pair and certificate with `npx expo-updates codesigning:generate` (keys go outside the repo), set `updates.codeSigningCertificate` and `updates.codeSigningMetadata` (`keyid`, `alg: 'rsa-v1_5-sha256'`) in `app.config.ts`, and publish with `eas update --private-key-path <path>`. The app then rejects an update that was not signed with your key. EAS Update code signing is available only on the EAS Production or Enterprise plans ([code signing](https://docs.expo.dev/eas-update/code-signing)); a fork on a lower plan has no signature check and must rely on account controls alone.
- **Guard:** the pre-push gate cannot prove an OTA. Add a manual preview-channel check to the release checklist: install the preview build, publish, confirm the update id in the About screen (3.2).
- **Security:** an OTA update executes new code on every device that matches the channel and runtime version. Protect the Expo account with 2FA, restrict who may run `eas update --channel production`, and enable code signing before real users.
- **Do NOT:** ship a native change by OTA (the app crashes on a mismatched native module), or reuse a `version` after changing a native dependency.
- **Note:** the `fallbackToCacheTimeout` range and the `fingerprint` policy above were checked on the SDK 57 pages ([app config](https://docs.expo.dev/versions/v57.0.0/config/app), [`expo-updates`](https://docs.expo.dev/versions/v57.0.0/sdk/updates)); cross-check any other key against the SDK 57 page, not `latest`, before copying.

---

## Phase 6 — Native capabilities: push notifications and deep links

### 6.1 Push notifications (`expo-notifications`)

- **Trigger:** a re-engagement or transactional notification requirement.
- **Install:** `npx expo install expo-notifications expo-device expo-constants` (`expo-constants` is already a dependency; `expo-device` is also used in 3.2).
- **Where it plugs in:** a `src/lib` module that registers the device, and a handler set at module scope in `src/app/_layout.tsx`; permission is requested from a screen with a clear reason, not at launch. The Expo push token and platform are sent to your backend.
- **Config and why:**
    - Project id for the token: `Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId` (the shape in the Expo push docs). `app.config.ts` already sets `extra.eas.projectId` when `EAS_PROJECT_ID` is present.
    - Remote push requires a development build or a store build on Android (not Expo Go) and a real device (`expo-device`'s `isDevice`). iOS needs the push entitlement on the app id; EAS Build handles credentials when asked.
    - Foreground handler: `setNotificationHandler` returns `shouldShowBanner` and `shouldShowList` (the fields named in the current docs), plus the sound and badge fields.
    - Android needs a notification channel created before the first notification; set its importance deliberately.
    - Add the `expo-notifications` entry to `plugins` (icon and colour options are native config: `prebuild --clean`, rebuild, bump `version`).
- **Guard:** a Jest mock for `expo-notifications` in `src/test/setup.ts`; a test that registration is skipped when permission is denied and on a simulator; a Maestro flow cannot receive a real push, so manual QA on a real device stays in the release checklist.
- **Security:** a push token identifies a device installation: send it only over HTTPS to your own backend, never log it, and delete it server-side on logout. Payloads are visible to the push provider and the OS: no secrets or personal data in the notification body.
- **Do NOT:** ask for permission at first launch before the user has seen why, or build a notification flow without opt-out and a settings screen link.
- **Doc sources:** [push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup), [receiving notifications](https://docs.expo.dev/push-notifications/receiving-notifications), [`expo-notifications`](https://docs.expo.dev/versions/latest/sdk/notifications).

### 6.2 Deep links and universal links

- **Trigger:** links from email, web or another app must open a screen, or an OAuth redirect must come back.
- **Install:** nothing (`expo-linking` and Expo Router are installed).
- **Where it plugs in:** `scheme` in `app.config.ts` (custom scheme, already set); `ios.associatedDomains` and Android `intentFilters` with `autoVerify` for https links; the route files under `src/app` are the link targets; an optional `+native-intent.tsx` in `src/app` rewrites an incoming path before routing.
- **Config and why:**
    - **Custom scheme links** (`yourscheme://path`) work with no hosting but can be claimed by any app. Use them for development, QR tools and OAuth redirects only.
    - **Universal links (iOS)** and **verified app links (Android)** need a domain you control: an `apple-app-site-association` file and `assetlinks.json` served at `/.well-known/` over https (the Expo link docs describe the file shapes; the stores' no-redirect requirement is training data, **unverified**). They are the only link type to put in email and on the web.
    - `+native-intent.tsx` exports `redirectSystemPath`; wrap it in `try/catch`, validate the incoming path against a whitelist of known routes, and fall back to the home route instead of throwing.
    - Test without a device farm: `npx uri-scheme open <url> --ios` (or `--android`) opens a link on a booted simulator or emulator.
- **Guard:** a unit test for the `redirectSystemPath` whitelist (known path passes, unknown path falls back, a path with a protocol or `..` is rejected); a Maestro flow that launches the app with a link.
- **Security:** an incoming link is untrusted input. Never route a link parameter straight into an authenticated action (a delete, a purchase confirmation); treat it as a navigation hint and re-check authorization. Never put a token in a link.
- **Do NOT:** change `scheme` after release, or use a custom-scheme link for a flow that carries a one-time code (another app can register the same scheme).
- **Native:** `associatedDomains` and `intentFilters` are native config: `prebuild --clean`, rebuild, bump `version`.
- **Doc sources:** [Android app links](https://docs.expo.dev/linking/android-app-links), [`+native-intent`](https://docs.expo.dev/router/advanced/native-intent), [Apple handoff / AASA file shape](https://docs.expo.dev/router/advanced/apple-handoff), [lifecycle listeners (`uri-scheme`)](https://docs.expo.dev/brownfield/lifecycle-listeners).

---

## Phase 7 — UI and performance

### 7.1 SVG icons (`react-native-svg`)

- **Trigger:** a design needs icons that Ionicons (the bundled set) does not have: a brand mark, a custom pictogram, an icon set such as lucide. [`DECISIONS.md`](./DECISIONS.md) § Icons records why the template stays on `@expo/vector-icons`, and that a lucide set adds a dependency plus `react-native-svg`.
- **Install:** `npx expo install react-native-svg`.
- **Where it plugs in:** today `IconButton` (`src/shared/ui/IconButton`) takes an Ionicons glyph name as `icon`, and `Button` (`src/shared/ui/Button`) has no icon slot; tab icons are Ionicons names in `src/shared/lib/constants/tabBarIcons.ts`. Add one `Icon` primitive in the shared UI layer that renders either an Ionicons name or an SVG component, then let `IconButton` accept the same value and give `Button` an optional leading icon. Colour and size come from the primitive's callers through the existing tokens (`getThemeColorValue`, `CONTROL_SIZE_TOKENS`), never from a hex literal.
- **Config and why:**
    - Write each icon as a small TSX component (an `Svg` with `Path` children) rather than adding a Metro SVG transformer: no Metro or Babel change, the gate and the bundler stay as they are, and tree shaking works per icon.
    - Take `color` and `size` props and pass `color` to `fill` or `stroke`, so one component serves both themes. `currentColor` is not reliable on native (opinion).
    - Give decorative icons `accessible={false}`, and labelled controls an `accessibilityLabel` on the `Pressable` (the `IconButton` already requires one).
- **Guard:** a colocated test per primitive (renders the Ionicons path and the SVG path, size and colour flow through); extend the existing `IconButton` test. If Jest cannot load the package, add a mock in `src/test/setup.ts` rather than loosening `transformIgnorePatterns`.
- **Security:** an SVG imported from outside is code-adjacent data: convert it to a component by hand, do not render remote SVG strings.
- **Do NOT:** add the package for one logo (a PNG asset does that), or add an SVG transformer to the Metro config for a handful of icons.
- **Native:** a native module. Rebuild the dev client, bump `version`, run `npm run doctor`.
- **Doc source:** [`react-native-svg` in the SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/svg) (the install line above is the one it gives). The package is already matched by the `react-native` prefix in the `transformIgnorePatterns` entry in `package.json`, so Jest transforms it.

### 7.2 Edge-to-edge: do NOT add `react-native-edge-to-edge`

The package was removed from the template. On Android, edge-to-edge is the platform default for apps targeting Android 15 (API level 35) and above, and the Expo docs checked for this file treat it as the default for Expo apps, so there is nothing to enable. This repo's React Native 0.86.3 sets `targetSdk = "36"` (`node_modules/react-native/gradle/libs.versions.toml` after install), so a build targets API level 36. The old `edgeToEdgeEnabled` key is absent from the installed `@expo/config-types` schema. What a screen still owes:

- Draw below the system bars deliberately: use insets from `react-native-safe-area-context` (already installed) through the `Screen` primitive in `src/shared/ui/Screen`, not a hardcoded padding.
- Status bar style through `expo-status-bar` (installed). Navigation bar styling on Android through `expo-navigation-bar` **only if a design needs it** (not installed).
- Keyboard resize behaviour is `android.softwareKeyboardLayoutMode` in `app.config.ts`; with edge-to-edge, test forms on a real Android device.

Re-add the package only if a documented SDK 57 limitation names it. Doc source: the Expo edge-to-edge and system-bars pages (checked via context7 in an earlier pass).

### 7.3 Images (`expo-image`)

- **Trigger:** remote images, lists of images, or placeholders.
- **Install:** `npx expo install expo-image`.
- **Where it plugs in:** a shared `Image` wrapper in `src/shared/ui` that fixes the defaults.
- **Config and why:** `cachePolicy` defaults to disk caching; use `memory-disk` for images a list scrolls back to. Give every remote image a `placeholder` (a blurhash or thumbhash) and `contentFit`, add a short `transition`, and `Image.prefetch` the next screen's hero image. In a recycling list (FlashList) set `recyclingKey` to the item id, so a recycled cell shows the placeholder instead of the previous item's image while loading.
- **Guard:** a wrapper test that the defaults are applied. `npm run perf:check` checks the Hermes JavaScript bundle bytes only (`scripts/capture-bundle-metrics.mjs`, run in CI by the `bundle-budget` job): it shows the JavaScript side of the package, not its native binary size.
- **Security:** only fetch images over https and from hosts you expect; user-supplied URLs go through an allowlist.
- **Do NOT:** use it for icons (7.1) or for local assets that `require` serves.
- **Native:** a native module: rebuild, bump `version`.
- **Doc source:** [`expo-image` for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image) (`cachePolicy` default `'disk'`, `recyclingKey`, `prefetch`).

### 7.4 Optional capabilities

| Capability             | Library                                       | When                                                                                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long lists             | `@shopify/flash-list` (`npx expo install`)    | A list over a few hundred rows or with heavy rows. v2 needs the New Architecture (mandatory here), drops `estimatedItemSize` and takes `getItemType` for mixed row shapes. Checked via context7 in an earlier pass; keep `FlatList` for short lists.    |
| Keyboard handling      | `react-native-keyboard-controller`            | Forms with sticky footers or chat inputs. `npx expo install`, needs a dev build, wrap the app in its `KeyboardProvider`. It replaces ad hoc `KeyboardAvoidingView` code; do not run both.                                                               |
| Fast encrypted storage | `react-native-mmkv`                           | AsyncStorage became a bottleneck, or a persisted store needs encryption at rest. `npx expo install react-native-mmkv react-native-nitro-modules`, `createMMKV` with an `encryptionKey` (the key itself belongs in `expo-secure-store`). Dev build only. |
| i18n growth            | `react-i18next` (already installed)           | More than one locale, plural rules or interpolation. See [`DECISIONS.md`](./DECISIONS.md) § i18n for why the setup is minimal; add locale JSON under `src/shared/locales`, keep keys typed, and test missing keys.                                      |
| Forms at scale         | `react-hook-form` + `zodResolver` (installed) | Already the documented default for non-trivial forms (`AGENTS.md`).                                                                                                                                                                                     |
| ATT prompt             | `expo-tracking-transparency`                  | Only if you track across apps or sites (3.3).                                                                                                                                                                                                           |
| Social / OAuth sign-in | `expo-auth-session`, `expo-web-browser`       | Not researched for this file; read the Expo docs page and the scheme note in 2.3 first.                                                                                                                                                                 |

For each row: native module means rebuild plus a `version` bump; add a Jest mock; update the docs listed under "Cross-references".

### Intentionally NOT recommended

- **Redux / MobX / a second state library.** Server state is TanStack Query, client state is Zustand with `createSelectors` (`AGENTS.md`).
- **A Metro SVG transformer** for a handful of icons (7.1).
- **`react-native-edge-to-edge`** (7.2): the platform default made it redundant.
- **Hand-editing `ios/` or `android/`** to add a capability: config plugins in `app.config.ts` own that.
- **Bumping a native package past the SDK list** to get a feature (`AGENTS.md` § Version holds): upgrade the SDK instead.
- **Anything on the reject list in [`DECISIONS.md`](./DECISIONS.md)**: read it before proposing a tool that was already considered.

---

## Scale-out patterns (when the app grows)

| Pattern                              | Trigger                                              | Notes                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature folders under `src/features` | The second screen group with its own data            | `src/features/README.md` and `.cursor/rules/fsd-layers.mdc` define the slice shape; lint enforces the import direction.                    |
| Feature flags                        | A risky release needs a kill switch                  | Fetch flags through TanStack Query with a long `staleTime`, expose one `useFlag(name)` hook, and keep a safe default for the offline case. |
| Error budget and release health      | A reporter is live (3.1)                             | Track crash-free sessions per release; pause an OTA rollout when the rate drops.                                                           |
| Performance baselines                | The first slow screen report                         | `npm run perf:check` keeps the bundle budget; profile on a mid-range Android device, not a simulator.                                      |
| E2E coverage                         | A flow that must never break (sign in, core journey) | Add a Maestro flow beside `.maestro/smoke.yaml` and `.maestro/create-task.yaml`; keep the unit layer as the main safety net.               |
| Monorepo or shared packages          | A second app shares code                             | Needs Metro and EAS changes beyond this file: decide in `DECISIONS.md` first.                                                              |

---

## Cross-references — what to update when graduating

When you graduate any phase, update these in the same PR so the brain does not drift:

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md): the stack table row, and the "Not yet wired" and adoption tables (remove the row that became real).
- [`MAP.md`](./MAP.md): entry points, the state boundaries and the route table.
- [`SKELETONS.md`](./SKELETONS.md): a new danger zone if the addition introduces one (for example, crash-reporter init must not hide render errors).
- [`VERIFICATION.md`](./VERIFICATION.md): a new check to run when touching the new domain.
- [`DECISIONS.md`](./DECISIONS.md): a dated entry for a choice with alternatives (a runtime version policy, a vendor).
- `README.md`: only when developer-facing scripts or setup change.
- `.env.example` and `src/env.ts`: every new variable.

If a phase introduces a recurring class of failure, add it to `SKELETONS.md`.

---

## When NOT to use this checklist

- **A throwaway prototype in Expo Go.** Skip everything except Phase 1 and ship; the native phases need a dev build.
- **An internal tool for one team.** Skip analytics, deep links beyond a scheme, and OTA code signing; keep crash reporting.
- **A read-only companion app.** Skip Phase 2 beyond a static token and Phase 4 persistence.

The template is opinionated and this file is a menu, not a mandate. Pick what the product needs, in the order the product needs it.
