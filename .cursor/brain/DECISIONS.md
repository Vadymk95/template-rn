# DECISIONS — Why these, not others

History lives in `git log -p -- .cursor/brain/DECISIONS.md` and the linked PRs; this file holds only what is true today (entries ≤30 lines after their heading, one index row each, both held by `docs:check`: context, decision, consequences, status, evidence), and a reversed decision is rewritten or deleted here, never archived.

## Index

| Decision                                                               | Date    | Status                                 |
| ---------------------------------------------------------------------- | ------- | -------------------------------------- |
| Expo managed over bare React Native                                    | 2026-04 | in force                               |
| Expo Router over React Navigation standalone                           | 2026-04 | in force                               |
| Expo SDK 57 baseline                                                   | 2026-07 | in force; SDK 58 held                  |
| NativeWind 4.2 on Tailwind 3.4, not v5                                 | 2026-04 | in force; version hold                 |
| Tailwind scans product code, not tests                                 | 2026-10 | in force                               |
| Dependencies: the SDK list is the authority, holds are data            | 2026-10 | in force                               |
| Override floors with major caps, dated allowances                      | 2026-10 | in force; allowances expire 2026-12-01 |
| ESLint 10 and `eslint-config-expo`                                     | 2026-07 | in force                               |
| Oxlint before ESLint                                                   | 2026-04 | in force                               |
| 4-space indent, single quotes                                          | 2026-04 | in force                               |
| Jest and jest-expo, not Vitest                                         | 2026-04 | in force                               |
| Jest coverage thresholds and exclusions                                | 2026-04 | in force                               |
| Gate-script specs run on `node:test`                                   | 2026-07 | in force                               |
| One entry-point guard for every gate script                            | 2026-10 | in force                               |
| Test servers bind ports below the ephemeral ranges                     | 2026-10 | in force                               |
| Jest does not reset mocks between tests                                | 2026-10 | in force                               |
| `expo-secure-store` for tokens, AsyncStorage for cache                 | 2026-04 | in force                               |
| No observability vendor in the template                                | 2026-04 | in force                               |
| i18n and forms in the template, auth and crash reporting not           | 2026-04 | in force                               |
| `@t3-oss/env-core` and Zod                                             | 2026-04 | in force                               |
| Icons: `@expo/vector-icons`, not `lucide-react-native`                 | 2026-04 | in force                               |
| Design tokens are vocabulary, not call sites                           | 2026-04 | in force                               |
| [2026-05] Boundary validation via Zod safeFetch wrapper (mobile-aware) | 2026-05 | in force                               |
| Magic strings become constants (storage keys)                          | 2026-05 | in force                               |
| Raw hex and magic numbers are lint errors                              | 2026-07 | in force                               |
| Native colour values mirror `global.css`                               | 2026-10 | in force                               |
| The gate contract: `verify` is a superset of CI                        | 2026-07 | in force                               |
| The gate chain has one readable home                                   | 2026-10 | in force                               |
| docs:check reads the tree as a clean checkout does                     | 2026-10 | in force                               |
| The gate's strict flags are read from the commands                     | 2026-10 | in force                               |
| Gate tests pin the git defaults their flags override                   | 2026-10 | in force                               |
| The app sits at the git root                                           | 2026-10 | in force                               |
| The iterate chain lints, widens and pins its legs                      | 2026-10 | in force                               |
| Fail-closed audit gate                                                 | 2026-07 | in force                               |
| `docs:check` guards CI steps, ruleset contexts and its own trigger     | 2026-10 | in force                               |
| TDD sibling gate on pre-commit, no auto-commit hook                    | 2026-07 | in force                               |
| Complexity ratchet                                                     | 2026-08 | in force                               |
| Mutation testing: weekly strength gate, outside `verify`               | 2026-08 | in force                               |
| Content variance on native: props, not pixels                          | 2026-08 | in force                               |
| Secret scan, CodeQL and SHA-pinned actions                             | 2026-07 | in force                               |
| zizmor audits the workflow files                                       | 2026-10 | in force                               |
| Cleartext traffic cannot be enabled unnoticed                          | 2026-10 | in force                               |
| Agent limits in a committed `.claude/settings.json`                    | 2026-09 | in force; not a security boundary      |
| One Dependabot group; release token wired                              | 2026-09 | in force                               |
| Role commands in `.claude/commands/`, pointers in `.cursor/commands/`  | 2026-07 | in force                               |
| Deliberately not adopted from the sibling web templates                | 2026-07 | in force                               |
| Audit backlog: what the template adopts and defers                     | 2026-04 | in force                               |
| React Compiler silent-bailout awareness                                | 2026-05 | in force                               |
| REJECT list: explicit non-adoption                                     | 2026-05 | in force                               |

## Expo managed over bare React Native

- **Context**: EAS Build removes the Mac requirement for iOS, the first blocker for a solo developer.
- **Decision**: managed workflow; `app.config.ts` plus prebuild (Continuous Native Generation) keeps `ios/` and `android/` out of the repo, so there is no hand-edited `Podfile` drift. Config plugins cover every vendor SDK needed so far.
- **Consequences**: native code is reachable only through config plugins.
- **Status**: in force. Revisit if a native module appears with no plugin we can write ourselves.
- **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f).

## Expo Router over React Navigation standalone

- **Decision**: file-based routes (the Next.js App Router mental model); typed routes, deep links and URL handling come with it. The bundle cost is accepted for an MVP.
- **Status**: in force. **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f).

## Expo SDK 57 baseline

- **Context**: upgraded from SDK 55 on 2026-07-16 by `npx expo install expo@^57 --fix`; the SDK 56 attempt had been reverted over 360 typecheck errors that the jump to 57 resolved (jest globals via `"types": ["jest", "node"]`, `splash` moved to the `expo-splash-screen` plugin, `ColorValue` for tab icon colours, RNTL 14 async API).
- **Decision**: SDK 57 with React Native 0.86 and React 19.2. The New Architecture is the only option (Legacy was dropped in SDK 55), so `newArchEnabled` is not a flag to set. The React Compiler is on through `experiments.reactCompiler: true`.
- **Consequences**: SDK 58 stays out until Expo's `latest` tag moves to it; the hold is in `scripts/version-holds.json`.
- **Status**: in force. **Evidence**: [0f9c932](https://github.com/Vadymk95/template-rn/commit/0f9c932), [PR #44](https://github.com/Vadymk95/template-rn/pull/44).

## NativeWind 4.2 on Tailwind 3.4, not v5

- **Context**: NativeWind v5 needs Tailwind v4 and is pre-stable; `tailwindcss@4` publishes no `lib/` modules, which `nativewind@4.2` requires.
- **Decision**: NativeWind 4.2 (it carries the Reanimated v4 compatibility patch) on Tailwind 3.4 with a JS config.
- **Consequences**: the Tailwind v4 class-hygiene lint plugins used by the web templates do not apply here.
- **Status**: in force; lifts with a stable NativeWind v5 (`tailwindcss` hold in `scripts/version-holds.json`).
- **Evidence**: [PR #44](https://github.com/Vadymk95/template-rn/pull/44).

## Tailwind scans product code, not tests

- **Context**: NativeWind compiles the utilities Tailwind finds in the `content` files. `./src/**/*.{ts,tsx}` also matched every test file and `src/test` helper, so a word in one that spells a utility compiled a rule no screen uses. Measured with Tailwind's own CLI on the real tree and the real config: 14811 bytes of CSS, 14117 once the tests are left out; nine rules (`.block`, `.collapse`, `.container`, `.hidden`, `.invisible`, `.min-w-0`, `.px-2`, `.relative`, `.shrink`) came from tests and helpers only.
- **Decision**: `content` keeps the `src` glob and negates `*.test.{ts,tsx}` and `src/test/**` (Tailwind 3.4 supports negated patterns). Everything at the top level stays unscanned, and a new folder under `src` is scanned until it is negated. The guard is a test, not a longer list: `scripts/tailwind-scan.test.mjs` copies the real `content` array into a throwaway tree of product files, test files and helpers, compiles it with Tailwind's own CLI (`postcss` is not a dependency here), and fails when a test file's utility compiles or a product file's does not. One glob per layer was rejected: a layer the list misses loses its styles with no error, because the tests do not render compiled CSS.
- **Consequences**: the compiled CSS is a subset of what it was, so the bundle cannot grow from it; `scripts/perf-baseline.json` is unchanged (`npm run perf:check` fails on growth only) and no Hermes bundle was re-measured. `*.spec.*` files are not negated: none exist here.
- **Status**: in force. **Evidence**: `scripts/tailwind-scan.test.mjs`.

## Dependencies: the SDK list is the authority, holds are data

- **Context**: `npm outdated` names versions the installed SDK does not support; taking them breaks Expo Go and the `jest-expo` pairing. `.npmrc` carries `min-release-age=3` (a release younger than three days is refused) and `ignore-scripts=true`.
- **Decision**: native package versions come from the installed `expo`'s `bundledNativeModules.json` (`npx expo install --check` / `--fix`), never from `npm outdated`. Every package held below a newer release is one entry in `scripts/version-holds.json` (range, reason, lift condition, evidence); `check-version-holds.mjs` runs in `verify` and fails when `package.json`, the lockfile or `.github/dependabot.yml` disagree with it.
- **Consequences**: `expo install --check` and `expo-doctor` can go red for a patch the cooldown still refuses; wait for the age to pass. The cooldown is lowered only by an operator decision for one install, recorded in that PR; `.npmrc` itself stays. `yaml` is a devDependency only to satisfy `postcss-load-config`'s optional peer (the hoisted `yaml@1` from `@expo/ngrok` made `npm ls --all` exit 1); nothing imports it, drop it when that peer goes.
- **Status**: in force. A hold is lifted by its own condition, checked when a Dependabot PR or an upstream release arrives, not on a calendar.
- **Evidence**: [PR #44](https://github.com/Vadymk95/template-rn/pull/44), [aa1f7de](https://github.com/Vadymk95/template-rn/commit/aa1f7de).

## Override floors with major caps, dated allowances

- **Context**: a transitive advisory with a fixed release is closed with a root `overrides` floor; npm's own suggested fix was once a semver-major downgrade of `eslint-config-expo`, which is destructive. Our own uncapped floors (`brace-expansion`, `fast-uri`) aged into later advisories' vulnerable ranges.
- **Decision**: every floor carries a major cap (`">=fixed <next-major"`), and two majors need two floors keyed by major (`"js-yaml@^3"` and `"js-yaml@^4"`; the parent-scoped form made `npm ls --all` flaky). An advisory with no fixed release in the major its dependents accept gets a dated entry in `scripts/audit-allowlist.json` (`id`, `expires`, `reason`, `upstream`), not a floor: a floor across majors would break the cap.
- **Consequences**: `node-forge` (GHSA-86w9-cpqp-85rv, no patched release; reached through `expo-updates` and `@expo/cli`, which parse no attacker-supplied RSA signature in a shipped app) and the `zod` 3.25.76 copies under `@expo/cli` and `eslint-plugin-react-compiler` (GHSA-mrhx-c7xc-m3w5, fixed only from zod 4.6.6, so no patched 3.x; the app's own zod is the top-level 4.6.7, held there by `package.json` `^4.6.7`, because an allowance keyed by advisory id covers that copy too) are allowed until 2026-12-01. At expiry, check `npm view <pkg> versions` and the upstream chain for a release past the vulnerable range; re-date only with a fresh reading. The `audit:gate` guard prints each allowance on every run and fails an expired or stale one.
- **Status**: in force. **Evidence**: [1f90e46](https://github.com/Vadymk95/template-rn/commit/1f90e46), [PR #44](https://github.com/Vadymk95/template-rn/pull/44).

## ESLint 10 and `eslint-config-expo`

- **Context**: ESLint 9 is end of life. `eslint-config-expo` sets `settings.react.version: 'detect'`, and under ESLint 10 that path calls the removed `context.getFilename()`, so every React rule throws at load.
- **Decision**: ESLint 10 with a trailing config object in `eslint.config.mjs` that sets `settings.react.version` to a literal; it has no `files` key and comes last, so it wins over the Expo preset. `eslint-plugin-react` and `eslint-plugin-import` (peer capped below 10) are mapped to the installed ESLint through root `overrides` (`{ "eslint": "$eslint" }`), never `--legacy-peer-deps`. Type-aware rules stay scoped to `src/**`.
- **Consequences**: removing the trailing block reproduces the crash (verified, still true on `eslint-config-expo@57`). `eslint-plugin-oxlint` is deliberately not installed: the two linters run as separate passes, so `oxlint` has no lockstep partner and bumps on its own.
- **Status**: in force; `eslint` and `@eslint/js` ceilings in `scripts/version-holds.json`.
- **Evidence**: [2beb9f2](https://github.com/Vadymk95/template-rn/commit/2beb9f2), `eslint.config.mjs`.

## Oxlint before ESLint

- **Decision**: `lint-staged` runs Oxlint first (milliseconds, obvious bugs), then ESLint, which stays the source of truth; the pre-pass keeps pre-commit fast on large changesets.
- **Status**: in force. **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f).

## 4-space indent, single quotes

- **Decision**: a personal preference recorded in `.prettierrc.json`; the community React Native norm is 2 spaces. Adjust if onboarding friction becomes real.
- **Status**: in force. **Evidence**: `.prettierrc.json`.

## Jest and jest-expo, not Vitest

- **Context**: Vitest React Native support is still rough with Reanimated and NativeWind mocks; `jest-expo` ships the right `transformIgnorePatterns`.
- **Decision**: Jest with `jest-expo`; matchers come built in with React Native Testing Library (`@testing-library/jest-native` is deprecated); mocks live in `src/test/setup.ts`. `jest-expo` runs Babel through the app's `babel.config.js`, so `babel-preset-expo` must stay resolvable from the project root (a direct dependency) for `npm test` to run.
- **Consequences**: Jest stays on 29 while `jest-expo` depends on `babel-jest@29`, which also holds `@babel/core` at 7 (both in `scripts/version-holds.json`).
- **Status**: in force. **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f), `package.json`.

## Jest coverage thresholds and exclusions

- **Decision**: global thresholds are statements, lines and functions 80, branches 60. `collectCoverageFrom` excludes `src/app/`, `src/env.ts` (ESM-only `@t3-oss/env-core`; Zod enforces it at runtime), `src/shared/lib/constants/**`, `src/shared/lib/i18n/**` and `src/shared/locales/**` (declarative tables, JSON and init glue; typecheck, ESLint and smoke cover them).
- **Consequences**: add tests when logic grows in those paths (for example dynamic route builders). `scripts/check-coverage.mjs` refuses a report that silently dropped a file; the Stryker `mutate` globs mirror these exclusions (`scripts/mutation-scope.test.mjs` fails on drift).
- **Status**: in force. **Evidence**: `package.json` (`jest.coverageThreshold`), [44a1929](https://github.com/Vadymk95/template-rn/commit/44a1929).

## Gate-script specs run on `node:test`

- **Context**: the gate scripts are executable ESM (`.mjs`); Jest 29 does not discover that extension or load real ESM without `--experimental-vm-modules`. In a sibling template, folding gate scripts into the app's coverage run dropped line coverage from 93% to 82% with no app change.
- **Decision**: `npm run test:scripts` is `node --test "scripts/**/*.test.mjs"`, no config, outside `collectCoverageFrom`. The glob is quoted so Node expands it (an unquoted glob relies on the shell, which does not glob on Windows).
- **Status**: in force. **Evidence**: [4a29b21](https://github.com/Vadymk95/template-rn/commit/4a29b21).

## One entry-point guard for every gate script

- **Context**: each gate script asked "was I started directly?" with `import.meta.url === new URL('file://' + process.argv[1]).href`. Through a symlink node gives the module the URL of its real path, and a `#`, `%` or `?` in the path is read as a fragment, a query or an escape, so the comparison failed: the script ran nothing and exited 0. For a check that is a pass that checked nothing.
- **Decision**: `scripts/is-entry-point.mjs` exports `isEntryPoint(import.meta.url)`. It builds the URL with `pathToFileURL` and compares the entry as given and as its real path. Every script that runs a `main()` imports it in one shape and guards with `if (isEntryPoint(import.meta.url)) {`. `scripts/is-entry-point.test.mjs` pins the helper (symlinks, paths with `#`, `%`, `?` and a space, an imported module, no entry file) and fails any script that reads `argv[1]` itself or uses the helper in another shape.
- **Consequences**: a new script copies the shape or the scan fails. Scripts that run at module load (`scripts/check-hooks.mjs`, `scripts/capture-bundle-metrics.mjs`) have no guard and stay outside the class. The helper is a byte copy of the sibling web template's, so a fix lands in each of them the same way.
- **Status**: in force. **Evidence**: `scripts/is-entry-point.test.mjs`.

## Test servers bind ports below the ephemeral ranges

- **Context**: `server.listen(0)` takes a port from the OS's ephemeral range (32768 and up on Linux and macOS; one measured 55207 here), and macOS hands them out in sequence, so a test that binds one can land next to ports another process is walking. The one test here that binds a socket (`scripts/check-lock-age.test.mjs`, a local registry) shared that exposure.
- **Decision**: `scripts/quiet-ports.mjs` hands out ports from 10000-19999, below every ephemeral range and clear of 20000-29999, where other tools' tests run. Each checkout takes a window of 100 ports picked by a hash of its path, and each test file that binds takes a lane of its own inside it (`check-lock-age` here), because `node --test` runs files in parallel. A lane nobody registered throws. `scripts/quiet-ports.test.mjs` pins the windows and lanes, and the registry test asserts its port is below 32768.
- **Consequences**: a test that binds a port adds a lane to `LANES`. The module keeps the lanes of the sibling templates that have no test here, so it stays a byte copy of theirs.
- **Status**: in force. **Evidence**: `scripts/quiet-ports.test.mjs`, `scripts/check-lock-age.test.mjs`.

## Jest does not reset mocks between tests

- **Context**: Jest keeps a mock's calls and implementation from one test to the next by default, so the order of the tests in a file can decide a verdict. `resetMocks: true` closes that, and it was measured on the whole suite first (Jest 29.7.0, 36 suites, 192 tests, 16 files that use `jest.fn` or `spyOn`, 2 that set a `...Once` value, 9 that reset by hand).
- **Decision**: no `clearMocks`, `resetMocks` or `restoreMocks` in the jest block of `package.json`. A test that sets a return value, a spy or a `...Once` value on a shared mock resets it itself (9 test files do, by hand).
- **Measured**: `--clearMocks` and `--restoreMocks`: all 192 green. `--resetMocks`: 5 suites and 15 tests red, every one from an implementation it wiped. 13 tests read `undefined` insets from the safe-area-context mock (`useSafeAreaInsets` and `useSafeAreaFrame` are `jest.fn(impl)`; `Cannot read properties of undefined (reading 'top')` in the start guide, todo workspace and `Screen` suites). One test, the user store's persisted payload, got `undefined` from the in-memory async-storage mock (12 `jest.fn` calls, 11 of them with an implementation). One called `.catch` on the `undefined` that the wiped `hideAsync` mock of `src/test/setup.ts` returned (`SplashScreen.hideAsync()` in `src/app/_layout.tsx`; `preventAutoHideAsync()` runs once at import, before the first reset).
- **Consequences**: adopting `resetMocks` means rebuilding those implementations in a `beforeEach` of `src/test/setup.ts`; for the two library mocks that is a copy of the library's own mock code (the async-storage one is 107 lines) that drifts from the library, so it was not done. `clearMocks` and `restoreMocks` are green but leave a `mockReturnValue` or an unconsumed `...Once` on a module-level mock alive for the next test, which is the class that matters, so neither was adopted as a half measure. Revisit when the library mocks stop using `jest.fn(impl)`, or a Jest upgrade changes what `resetMocks` does (not measured here).
- **Status**: in force. **Evidence**: `src/test/setup.ts`.

## `expo-secure-store` for tokens, AsyncStorage for cache

- **Decision**: AsyncStorage is plaintext on both platforms; anything that grants API access goes to `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android). Auth tokens are stored via `src/lib/secureToken.ts`, with only the username in Zustand persist.
- **Status**: in force. **Evidence**: [62675e6](https://github.com/Vadymk95/template-rn/commit/62675e6).

## No observability vendor in the template

- **Context**: `@shopify/react-native-performance` is archived upstream (2025-11-26) with no named successor; Sentry is the common React Native choice but a vendor is a product decision.
- **Decision**: `src/lib/logger.ts` is a stub with a stable API (`report.capture`, `report.breadcrumb`); the product picks Sentry, Datadog or Bugsnag and implements those two, and call sites do not change. The Sentry recipe is in `EXTENSIONS.md` § 3.1.
- **Consequences**: forks either wire the SDK and `EXPO_PUBLIC_SENTRY_DSN` or remove that env key; one that ships personal or payment data configures `beforeSend` scrubbing and opts out of replays.
- **Status**: in force. **Evidence**: [31a9d36](https://github.com/Vadymk95/template-rn/commit/31a9d36), `src/lib/logger.ts`.

## i18n and forms in the template, auth and crash reporting not

- **Decision**: `i18next` + `react-i18next` ship with bundled JSON, typed keys and `expo-localization` for the initial language; remote-only catalogs (Phrase, Lokalise, CMS strings) are a product integration. `react-hook-form` + `@hookform/resolvers` (Zod) is the default for non-trivial inputs; a single-field input may use local state. No auth or crash-reporting SDK in the scaffold.
- **Status**: in force. **Evidence**: [62675e6](https://github.com/Vadymk95/template-rn/commit/62675e6).

## `@t3-oss/env-core` and Zod

- **Decision**: `src/env.ts` fails startup on a missing variable, which is cheaper than a runtime 500 on the first API call; `.env.example` is kept aligned with it.
- **Status**: in force. **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f).

## Icons: `@expo/vector-icons`, not `lucide-react-native`

- **Decision**: `@expo/vector-icons` ships with Expo at no install cost and covers 20+ sets (Ionicons, MaterialCommunity, Feather, FontAwesome). `lucide-react-native` looks better but adds a dependency and a `react-native-svg` round trip; for a generic template the stock set is the better default.
- **Consequences**: a design that needs a brand mark or a custom set follows the recipe in `EXTENSIONS.md`. The package is deprecated upstream (SDK 56+) but pinned and functional; the migration path is `npx @react-native-vector-icons/codemod`, a deliberate follow-up and not a drive-by.
- **Status**: in force. **Evidence**: [494809f](https://github.com/Vadymk95/template-rn/commit/494809f).

## Design tokens are vocabulary, not call sites

- **Decision**: `TYPOGRAPHY_TOKENS` and `SPACING_TOKENS` (`src/shared/lib/theme/**`) are an API surface for future slices, not application code with usage counts. Do not trim a token for having no external references: in a template that means "not used yet". Extend the scale when a slice needs a coherent step; remove only a token that is semantically wrong (ambiguous name, contradicts the ladder, duplicate).
- **Consequences**: the same holds for `src/shared/lib/constants/**` declarative tables and route maps. `src/shared/lib/theme/spacing.ts` and `typography.ts` cite this entry.
- **Status**: in force. **Evidence**: [44a1929](https://github.com/Vadymk95/template-rn/commit/44a1929).

## [2026-05] Boundary validation via Zod safeFetch wrapper (mobile-aware)

- **Context**: a mobile app cannot take a hotfix instantly (store review takes days; OTA reaches only the JS bundle), so backend schema drift reaches users before a patch can.
- **Decision**: validate every API response at the boundary with a Zod schema through `src/lib/api/safeFetch.ts`; the seed example is `src/lib/api/_exampleSafeQuery.ts`. A TanStack Query `queryFn` uses `safeFetchQueryFn(url, schema)` (an `AbortError` is re-thrown unchanged, so Query treats it as cancellation); direct fetches use `safeFetch(url, schema)`; AsyncStorage and secure-store reads use `Schema.safeParse(JSON.parse(raw))`. A `SchemaValidationError` is caught and shown as "data unavailable", and logged through `src/lib/logger.ts` as `[api] schema drift`.
- **Consequences**: no extra bundle (Zod is already a dependency), roughly 50-200 µs per response. Not for tRPC end-to-end codegen, throwaway prototypes or in-app function calls.
- **Status**: in force; drop the seed if a fork removes `safeFetch` from three or more endpoints or adopts tRPC codegen.
- **Evidence**: [7058d5e](https://github.com/Vadymk95/template-rn/commit/7058d5e), `src/lib/api/safeFetch.ts`.

## Magic strings become constants (storage keys)

- **Decision**: a string used in two or more places, or carrying an external contract, becomes a named constant, selectively. `src/lib/storageKeys.ts` holds `STORAGE_KEYS` (Zustand persist names, AsyncStorage) and `SECURE_STORAGE_KEYS` (secure-store, a separate object for the security boundary); renaming a key without migration silently loses user data on update. Constants are `as const` objects, not `enum`.
- **Consequences**: the TanStack Query key factory is deliberately not centralised: each feature owns `src/features/<name>/api/<name>Keys.ts` (`exampleKeys` is the seed). Not extracted: single-use strings, logger tags, i18n keys, vocabulary tokens, testIDs, domain enums such as `TODO_FILTERS`.
- **Status**: in force; drop the pattern from the seed if a fork adds more than three stores or five query keys without factories.
- **Evidence**: [e362987](https://github.com/Vadymk95/template-rn/commit/e362987).

## Raw hex and magic numbers are lint errors

- **Context**: both were written conventions with no enforcement; a copied `#0a0a0a` sat in `navigationTheme.ts` next to a comment forbidding raw hex, while the token it mirrored was `#09090B`.
- **Decision**: raw hex (`no-restricted-syntax`, string and template-literal selectors) is an error under `src/**` except `src/shared/lib/theme/**`; `@typescript-eslint/no-magic-numbers` is on with `-1 0 1 2 100 1000` plus enum members, array indexes, defaults, type indexes and a numeric literal type declared as an alias (`type Gap = 3 | 5`; the same union written inline in a property type still counts) allowed, exempt in `src/shared/lib/theme/**`, root config files and tests (a test that imports the constant it asserts is tautological). `no-empty` is on with `allowEmptyCatch: false`.
- **Consequences**: the tab bar tint now reads `useColorScheme()` and `getThemeColorValue`; `src/test/app/tabs-layout.test.tsx` guards it with a file-local `expo-router` mock, because the shared mock drops props.
- **Status**: in force. **Evidence**: [6fbe2ae](https://github.com/Vadymk95/template-rn/commit/6fbe2ae), [4ae66e3](https://github.com/Vadymk95/template-rn/commit/4ae66e3) ([PR #38](https://github.com/Vadymk95/template-rn/pull/38)), `scripts/lint-guards.test.mjs`.

## Native colour values mirror `global.css`

- **Context**: `COLOR_VALUES` (`src/shared/lib/theme/colors.ts`, hex) and the CSS variables in `global.css` (HSL) are hand-maintained in two files, and three values had already drifted.
- **Decision**: `global.css` (the shadcn/ui palette) is the source of truth. `colors.test.ts` converts every duplicated CSS variable to hex and asserts it against the matching `COLOR_VALUES` entry, light and dark.
- **Status**: in force, guarded by that test. **Evidence**: [PR #38](https://github.com/Vadymk95/template-rn/pull/38).

## The gate contract: `verify` is a superset of CI

- **Decision**: `verify` is every check that works offline, the TDD sibling range check included; `verify:ci` is what CI runs; the network-bound checks live there (they are the only checks that need the network). The Husky pre-push hook runs `verify:ci`, and the CI job runs it as a single step; `ci:local` is the full local parity run. A new check goes into the script, never only into a workflow file, so a green local run predicts a green pipeline (three sibling templates once broke exactly this).
- **Consequences**: the tier law (which checks run when) is in `AGENTS.md` § the gate and `scripts/gate-tiers.json`. Not in the gate: Maestro flows (`.maestro/`, `npm run maestro`) need a simulator or device, and `expo-doctor` reads live SDK state and can go red with no code change, so it is `continue-on-error` in CI.
- **Status**: in force. **Evidence**: [4a29b21](https://github.com/Vadymk95/template-rn/commit/4a29b21).

## The gate chain has one readable home

- **Context**: the stage order was retold by hand in 24 places, unchecked: the pre-push comment dropped `lock:age`.
- **Decision**: `checks.<name>.chain` is derived from the script and `docs:check` fails on any difference
  (deleting the view left pointers without a page). Elsewhere a file names a script and its purpose and points
  at the view. A line outside it also fails when it names 3 or more distinct stages, or composes a script
  whatever the count (a count of 3 never saw a pair): two of its parts (`a then b`, `x = a && b`) at most 2
  words apart, or the script and one part (`x runs a`) at most 4, in one sentence. Names come from the repo
  (multi-step scripts, their steps, `docs.stageWords`). The script is read by its own name, never by a word
  filed under it, and must be strong; of two parts, one must be, unless `&&` or an arrow joins them. Strong:
  in code or after `npm run`; spelled with a separator; a stage word no script or step spells (`eslint`, also
  a step, stays ordinary until it is in code); adjacent names are one unit, strong when any is. Read: docs
  (fences, tables, this file), workflow names and comments, `.husky/*` comments, `gate-tiers.json` prose.
- **Consequences**: a false positive costs a reword, never an allowance; the windows and
  `RETELLING_MIN_STAGES` move only on a measurement (places of the old tree caught, lines flagged on the
  rewritten tree):

| rule                                                 | caught of 24 | flagged |
| ---------------------------------------------------- | ------------ | ------- |
| 3+ stages (before)                                   | 15           | 0       |
| 2+ stages                                            | 20           | 30      |
| two stages and a connector (`&&`, `->`, `+`, `then`) | 10           | 0       |
| shipped                                              | 22           | 27      |

- **Status**: in force. Of the 27, 17 state what a script is made of; 10 are ordinary (lists, prohibitions,
  history). Not caught: 2 old places in files the check does not read (`.vscode/tasks.json`, `docs/`), a
  spread beyond the windows in words, lines or sentences, two bare words with no mark, script comments, code,
  issue templates, app copy, a one-name statement in a `gate-tiers.json` description (read without its key),
  a one-name alias statement in prose (a line saying one script is an alias of another). `docs:check` runs
  inside `verify` here too, because it ran only at pre-commit and weekly.
  **Evidence**: `scripts/docs-check.mjs` and its test, `scripts/gate-tiers.json`.

## docs:check reads the tree as a clean checkout does

- **Context**: the disk answers differently on a machine that kept an emptied folder or an ignored file than on a clean checkout, so the same docs were green here and red in CI. A line number in a pointer moves with every edit and nothing can check it. An index and a cap that only prose states are exceeded one entry at a time, and a typed `_measured` count in `scripts/gate-tiers.json` (`2 on 2026-09-13` for the flow suite) has no check behind it.
- **Decision**: a path in a doc resolves only to a file git lists (tracked, or new and not ignored) that is on disk, or to a folder holding one; this file is judged the same way, so an evidence link that points nowhere is red. A path that ends in a line number (`path:12`, `path:12-20`) is red: cite the symbol. This file keeps its shape: one index row per entry heading (compared without a `[YYYY-MM]` prefix; the `## Index` heading is not an entry) and at most 30 lines after a heading. Every run prints each suite's measurement (`suites.maestro: 2 file(s) of 4`), and a `_measured` key is a finding. Where git cannot list the files (no `.git`), the run says the path and line-pointer checks were skipped and leaves them out of its summary.
- **Consequences**: the first run over this tree found one entry 31 lines long (the gate-chain entry, now one line shorter), no line pointer and no index row without its heading. One heading and its row carry the `[2026-05]` prefix, which is why both sides are compared without it. The flow suite counts files, so a second subject of an existing flow becomes steps in that flow's file, never a new yaml file.
- **Status**: in force. **Evidence**: `scripts/docs-check.test.mjs`, `scripts/docs-check.mjs`.

## The gate's strict flags are read from the commands

- **Context**: `checks.<name>.chain` is derived from `package.json` and then compared with it, so a flag dropped from a script is dropped from the view the same way and both equality checks stay green.
- **Decision**: `docs:check` expands every gate script through its `npm run` steps (the arguments a step passes after its own `--` land on the last command of the target script, as npm appends them) and requires the flags that make a tool strict: for the linters `--max-warnings 0` (the last value counts) and `--deny-warnings`; a jest run never watches (a fork on vitest needs `run`). `--passWithNoTests` may appear only in the iterate chain, the check `moments.iterate` names in `scripts/gate-tiers.json`. A command ends at `&&`, `||`, `;` or a newline outside quotes, and `NAME=value`, `cross-env`, `env` and `npx` are looked through. What a `node scripts/*.mjs` step spawns is not read.
- **Consequences**: a lint that tolerates warnings, a test run that watches, or a "no tests found" pass is a gate that approves what it did not run. On this tree every gate command already carried its flags (`lint` has `--max-warnings 0`, `lint:oxlint` has `--deny-warnings` over `src`), and no `package.json` script carries `--passWithNoTests`: the iterate tier's jest runs from `scripts/iterate-tests.mjs`, whose arguments this rule does not read.
- **Status**: in force. **Evidence**: `scripts/docs-check.test.mjs`, `scripts/docs-check.mjs`.

## Gate tests pin the git defaults their flags override

- **Context**: `scripts/check-gate-integrity.mjs` passes `--no-renames`, `--no-prefix`, `--no-color` and `-c core.quotepath=off` so its answer does not depend on the machine it runs on. A test guards such a flag only while git would otherwise do the opposite, and that depends on the developer's global config.
- **Decision**: each fixture repository sets repository-local config that is the opposite of what each flag overrides (`diff.renames=true`, `diff.noprefix=false`, `core.quotepath=true`, `color.diff=always`). Repository-local config beats the global one, and the checker's own git reads it too.
- **Consequences**: measured on a scratch copy under a global git config that agrees with every flag (`diff.renames=false`, `diff.noprefix=true`, `core.quotepath=false`, `color.diff=never`), over the four `check-gate-integrity.*.test.mjs` files (470 tests): with the old fixtures, deleting any one of the four flags left all 470 green; with the fixture defaults, deleting `--no-renames` failed 2 tests, `--no-prefix` 81, `--no-color` 85 and the quotepath override 2.
- **Status**: in force. **Evidence**: `scripts/check-gate-integrity.fixtures.mjs`.

## The app sits at the git root

- **Context**: the gate scripts read git paths relative to the repository root (staged names, the hooks path, `ref:path`). From a subfolder they match nothing and say nothing, and the hooks check resolved the husky hooks folder against the folder it ran in, so an app installed in a subfolder passed while git ran no hook (the new test against the old script: exit 0 where it must refuse).
- **Decision**: `scripts/check-hooks.mjs`, the first step of `verify` and `verify:iter`, refuses an app whose folder is not the git root, CI included, and says so in three lines. Supporting a subfolder would rewrite every script that reads git paths and need a test of its own for each; the refusal costs one line in the README rename checklist.
- **Consequences**: an Expo app inside a monorepo is a plausible fork shape (inference), and that fork changes the gate scripts first. Not done: a subfolder port of the scripts, which is the operator's call.
- **Status**: in force. **Evidence**: `scripts/check-hooks.test.mjs`.

## The iterate chain lints, widens and pins its legs

- **Context**: the iterate chain ran no type-aware lint, so findings that need types first fired at the commit hook. A change to a file no test imports (the jest block in `package.json`, `babel.config.js`, `tsconfig.json`, the NativeWind and Metro configs, `src/test/setup.ts`) selected no test, and `--passWithNoTests` turned that into exit 0, so a broken config went green here and red at the push. `scripts/mutation-scope.test.mjs` reads configs as text and nothing imports it, so no selection reached it.
- **Decision**: `scripts/lint-changed.mjs` runs ESLint, with the flags and cache of `npm run lint`, on what differs from HEAD plus untracked files; `.cursor/**` is ignored, since nothing under it is product code. `scripts/iterate-tests.mjs` selects tests by change, but runs the whole suite, without `--passWithNoTests`, when one of its named paths is dirty (staged, untracked, deleted or renamed away) or git cannot answer. The scope test is a plain `node` step, named by its file: a raw `node --test` step reads as a stage called `node`, and any line saying "the Node engine" then counts as retelling the chain. `scripts/iterate-chain.test.mjs` fails a chain that drops a leg or brings back a raw jest step; `scripts/iterate-tests.test.mjs` fails a listed path that no longer exists and a jest setup file the list lacks.
- **Consequences**: measured on a scratch copy, three changed source files, warm caches: 3.7 s before, 4.7 s after; the ESLint leg alone 4.1 s on a cold cache and 0.9 s warm; the widened run, the whole suite, 3.4 s for 36 suites. The budget is 15 s (`scripts/gate-tiers.json`). A diff that touches no listed path keeps the module-graph selection, so a green run on an untested source change still proves nothing (`VERIFICATION.md` § Verification integrity).
- **Status**: in force. **Evidence**: `scripts/iterate-chain.test.mjs`, `scripts/iterate-tests.test.mjs`, `scripts/lint-changed.test.mjs`.

## Fail-closed audit gate

- **Context**: `npm audit --audit-level=high` passes when it cannot run (unreachable registry, auth failure, offline runner); a security gate that succeeds when it did not run is worse than none.
- **Decision**: `scripts/audit-gate.mjs` fails on an un-allowlisted high or critical advisory, an expired allowance, a stale allowance (its advisory no longer appears, so allowances cannot accumulate) and its own inability to complete. `evaluateAudit` is pure and `scripts/audit-gate.test.mjs` covers all four branches. An override floor is preferred; an allowance is the last resort (see the override-floor entry).
- **Status**: in force. **Evidence**: [4a29b21](https://github.com/Vadymk95/template-rn/commit/4a29b21).

## `docs:check` guards CI steps, ruleset contexts and its own trigger

- **Decision**: `docs:check` fails when a `run:` step in a PR-triggered workflow is not declared in `scripts/gate-tiers.json` § `ci.allowedRunSteps` (a check that runs only in CI, outside `verify`; block scalars are read line by line), and when a required status check in `.github/ruleset.json` is produced by no workflow job (job `name:` or id, plus matrix values) nor listed in `ci.rulesetContextAllowlist`. A job whose context GitHub renders only at runtime prints one non-failing line. The pre-commit hook runs `docs:check` whenever the staged set touches docs, rules, `.github/`, `.husky/`, `scripts/docs-check.*`, `scripts/gate-tiers.json` or `package.json`.
- **Consequences**: `scripts/docs-check.mjs` is byte-identical across the four templates, the `prPermission` check (a gitleaks job on a pull request needs `pull-requests: read`) included; this repo's data is in `gate-tiers.json`.
- **Status**: in force. **Evidence**: [PR #36](https://github.com/Vadymk95/template-rn/pull/36), [PR #38](https://github.com/Vadymk95/template-rn/pull/38).

## TDD sibling gate on pre-commit, no auto-commit hook

- **Decision**: `scripts/check-test-siblings.mjs` refuses a commit when a staged `src/**` file has no co-located `*.test.*` in the git index (an untracked test on disk does not count). It checks changed files only, a ratchet: existing untested files are not retroactively broken, the next edit to one needs a test. `verify` (so pre-push and CI) runs the same rule in `--range` mode against the HEAD tree, so a commit made with the hook skipped, or a PR from a clone without hooks, fails at push and in CI; the first commit of a repository has nothing to compare with and passes, staged (no HEAD yet) or in a range (no base). Its exempt list derives from this repo's `collectCoverageFrom` plus declaration-only modules; `src/shared/lib/theme/**` is not exempt. The hook proves existence, never worth: the mutation check (revert the fix, the test must go red) lives in `test-driven-development.mdc`.
- **Consequences**: pre-commit also runs the repo-wide cheap checks (the list is `.husky/pre-commit`), collecting all failures before deciding, because `lint-staged` restores the unstaged hunks of a partially staged file after fixing it. Not adopted: a hook that commits for you, which hides a formatting fix inside a commit nobody wrote; the hook prints the remedy (`npm run fix && git add -u`) instead.
- **Status**: in force. **Evidence**: [88f5551](https://github.com/Vadymk95/template-rn/commit/88f5551).

## Complexity ratchet

- **Context**: the thresholds come from a measurement of the tree (p95 complexity 5, one outlier at 20), not taste; an early threshold was derived from a truncated probe output and the gate caught the error on its first full run.
- **Decision**: five ESLint core rules gate `src/**` excluding tests: `complexity` 15, `max-depth` 3, `max-params` 4, `max-lines-per-function` 120, `max-lines` 200. `shared/ui/Button/Button.tsx` carries a file-scoped override pinned at its measured 20, so it cannot absorb growth. Tests are exempt on purpose: a `describe` block is one function to these rules and table-driven suites are long by design.
- **Consequences**: when a threshold fires, split the function; raising a number needs a fresh measurement and an edit of this entry. `eslint.config.mjs` cites this entry.
- **Status**: in force. **Evidence**: [310238b](https://github.com/Vadymk95/template-rn/commit/310238b), `eslint.config.mjs`.

## Mutation testing: weekly strength gate, outside `verify`

- **Context**: coverage cannot tell whether tests would catch a wrong implementation; the first baseline, 53.72%, sat under green 80/60/80/80 coverage floors.
- **Decision**: `npm run test:mutation` (StrykerJS with the Jest runner, `projectType: "custom"`, which reads the `package.json` Jest config; works with `jest-expo` unmodified) runs weekly through `mutation.yml` (cron and dispatch). `thresholds.break: 48` in `stryker.config.json` is a floor of record: raise it after a good run, never lower it to go green. Not in `verify` or pre-push (a full run takes minutes).
- **Consequences**: the score sees only the kill side (it cannot see an over-strict test) and purely visual mutants (those belong to `.maestro/`). `.stryker-tmp` and `reports` are ignored by git, the formatter and the linters, and `.env*` stays out of Stryker's sandbox through `ignorePatterns`, because a crashed run once left a sandbox that reddened an unrelated push. The runner's tree is inside the audit gate: a high advisory there gets an override floor, not an allowance.
- **Status**: in force. **Evidence**: [310238b](https://github.com/Vadymk95/template-rn/commit/310238b), [ed8e4f8](https://github.com/Vadymk95/template-rn/commit/ed8e4f8).

## Content variance on native: props, not pixels

- **Context**: the web siblings measure a fixture route in a browser; here RNTL has no layout engine and `.maestro/` needs a device and is outside the gate.
- **Decision**: content-bearing components are proven against content they have not seen, using the states in `src/test/contentStress.ts` (`minimal` / `typical` / `long` / `unbroken` text, `none` / `one` / `many` collections, plus OS font scale). Assertions are about the props that bound a layout (`numberOfLines` and `ellipsizeMode`, a `flex-1` text column, `MAX_FONT_SCALE_IN_FIXED_CONTROL`, bounded rather than `allowFontScaling={false}`), never about pixels.
- **Consequences**: `maxFontSizeMultiplier` does not survive NativeWind's JSX interop into what RNTL exposes, so that one contract is asserted against the module source, with the reason beside it. `scripts/check-coverage.mjs` exists because `jest --coverage` prints `Failed to collect coverage from <file>` and exits 0. `bench:verify` derives its step list from the `verify` script instead of restating it.
- **Status**: in force. **Evidence**: [d9f6747](https://github.com/Vadymk95/template-rn/commit/d9f6747), [320a17c](https://github.com/Vadymk95/template-rn/commit/320a17c).

## Secret scan, CodeQL and SHA-pinned actions

- **Decision**: `security.yml` runs gitleaks (full history, any plan) and CodeQL with the `security-extended` pack, plus a weekly cron so a mid-week CVE does not wait for the next push; its workflow token defaults to `contents: read`, and `release.yml` keeps its write scopes on the one `release-please` job. Every `uses:` names a full commit SHA with the version in a trailing comment (floating tags are mutable and have been retargeted in supply-chain attacks); Dependabot's `github-actions` ecosystem updates a pin and its comment together.
- **Consequences**: CodeQL needs GitHub code scanning, free on public repos and paid on private ones, so a private fork gets HTTP 403 from the upload step; enable Advanced Security or delete the `codeql` job, never weaken the workflow (stated in the workflow header and the README). `ios/` and `android/` are never committed, so CodeQL sees no native code and needs no `paths-ignore`.
- **Status**: in force. **Evidence**: [1437f16](https://github.com/Vadymk95/template-rn/commit/1437f16), [PR #39](https://github.com/Vadymk95/template-rn/pull/39).

## zizmor audits the workflow files

- **Decision**: `security.yml` has a `zizmor` job (check name `Workflow audit (zizmor)`, required in `.github/ruleset.json`) using `zizmorcore/zizmor-action` SHA-pinned, with `version` pinning zizmor itself (a newer zizmor is a deliberate edit), `min-severity: medium`, no SARIF upload. Every checkout sets `persist-credentials: false`. `.github/zizmor.yml` ignores `adhoc-packages` for `ci.yml` (the pinned `npm install -g npm` step) and remaps `artipacked` to medium.
- **Consequences**: the online grade differs from the offline one (`artipacked` is Low online, Medium offline), so the remap makes the local run (`uvx zizmor@<version> .github/workflows`) and CI return the same verdict. Any other deliberate exception goes in `.github/zizmor.yml` with a one-line reason, never a blanket ignore. A context must have reported once before the live ruleset can require it; the live ruleset is a repository setting (README, "What your fork does not inherit").
- **Status**: in force. **Evidence**: [PR #41](https://github.com/Vadymk95/template-rn/pull/41), [32af113](https://github.com/Vadymk95/template-rn/commit/32af113).

## Cleartext traffic cannot be enabled unnoticed

- **Decision**: `scripts/native-config.test.mjs` (a `node:test` spec inside `test:scripts`) reads the text of `app.config.ts` and of the files directly under a local `plugins/` directory, and fails on any line naming `usesCleartextTraffic`, `NSAllowsArbitraryLoads`, `NSExceptionAllowsInsecureHTTPLoads` or `NSTemporaryExceptionAllowsInsecureHTTPLoads` once each plain `<key>: false` is removed from it. `scripts/native-config-allowlist.json` (`{ key, reason }`) allows a key and fails closed: a malformed file, an unknown key, a blank reason and a stale entry all fail.
- **Consequences**: plain text on purpose, so a condition (`false || IS_DEV`, a conditional spread) cannot hide the value and a fork inherits one small file, not a test machine. Out of scope: deliberate obfuscation, subdirectories of `plugins/`, imports from elsewhere, `node_modules`, a static `app.json` (none here). A mention in a comment counts: reword it or add an allowance.
- **Status**: in force. **Evidence**: [PR #39](https://github.com/Vadymk95/template-rn/pull/39).

## Agent limits in a committed `.claude/settings.json`

- **Decision**: `.claude/settings.json` is tracked and denies, in every permission mode, reading `.env` files other than the example, editing itself, force pushes, `--no-verify`, `git reset --hard` and `git clean -f`; it asks before edits of the gate files. The rule text is in `AGENTS.md` § Lanes. Reopened 2026-09-28 by the owner: the earlier deferral waited for an agent to edit a listed file, and published guidance now names a deny list as the baseline of an agent setup.
- **Consequences**: it is not a security boundary. A Bash rule matches the command as written, so `sh -c`, a full binary path or a `git -C` / `git -c` prefix walks past it, and Read and Edit denies cover the built-in tools and recognised file commands, not a script that opens the file itself. `-uf` and a trailing `-n` still get through; more wildcards would start catching commit messages. The boundary is the required CI check. Cursor and Codex do not read the file.
- **Status**: in force. **Evidence**: [e05f975](https://github.com/Vadymk95/template-rn/commit/e05f975).

## One Dependabot group; release token wired

- **Decision**: one `minor-and-patch` group carries every non-major update (separate production and development groups both rewrote `package-lock.json`, so the second PR conflicted); a major opens its own PR. `release.yml` passes `secrets.RELEASE_PLEASE_TOKEN || github.token`: with the secret absent, release PR runs wait in `action_required` for one approval; with a fine-grained PAT in it they get CI like any PR.
- **Status**: in force. **Evidence**: [268bd6e](https://github.com/Vadymk95/template-rn/commit/268bd6e), [1ea8ee4](https://github.com/Vadymk95/template-rn/commit/1ea8ee4).

## Role commands in `.claude/commands/`, pointers in `.cursor/commands/`

- **Decision**: five role commands (`onboard`, `feat`, `test`, `review`, `docs`) name this repo's gate, danger zones and test infrastructure, so an agent does not rediscover the repo each session. `.cursor/commands/*.md` are thin pointers to the canonical `.claude/` file (copies drift; symlinks are fragile on Windows). `.claude/` is ignored by the global ghost-mode ignore, so the tracked paths need the ladder `!.claude/` → `!.claude/commands/` → `!.claude/commands/**` (git will not descend into an ignored directory to find a negation); `.claude/settings.json` is tracked, `settings.local.json` is not.
- **Consequences**: Cursor resolves personal commands before project ones, so an operator's own `~/.cursor/commands/{feat,test,review}.md` shadows the repo copies there; `onboard` and `docs` are unshadowed. In Claude Code the repo copies win.
- **Status**: in force. **Evidence**: [6b38c93](https://github.com/Vadymk95/template-rn/commit/6b38c93).

## Deliberately not adopted from the sibling web templates

- **Tailwind class-hygiene lint rules**: those plugins read a Tailwind v4 CSS config; this repo is Tailwind 3.4 with a JS config (a recorded hold), so they would no-op or misreport. Revisit with NativeWind 5.
- **`SECURITY_REQUIREMENTS.md`**: in the web templates it is HTTP headers, CSP and nonces; an app serves no document. The native equivalent (`EXPO_PUBLIC_*` is public, secure-store versus AsyncStorage, `app.config.ts` permissions, deep links as untrusted input, EAS secrets) is in `.cursor/brain/SECURITY_REVIEW.md` and `.github/copilot-instructions.md`.
- **e2e in the gate**: Maestro needs a simulator or device, which a CI runner lacks (see the gate contract).
- **`expo-doctor` as a blocking step**: it can go red with no code change, so it stays advisory (`continue-on-error`) in CI and in the full local parity run, never in the core gate.
- **Status**: in force. **Evidence**: [c3155eb](https://github.com/Vadymk95/template-rn/commit/c3155eb).

## Audit backlog: what the template adopts and defers

Recorded so forks do not re-litigate the list. Ghost principle: only **Adopted** items belong in the repo. Deferred tools and the trigger that adopts each: `PROJECT_CONTEXT.md` § "Full scope: strengths vs deferred tools".

| Item                                      | Decision | Reason or trigger                                                                                                      |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| react-hook-form + Zod resolvers           | Adopted  | single-field inputs may still use `useState`                                                                           |
| Bundle budget in CI                       | Adopted  | `bundle-budget` job in `ci.yml` runs `npm run perf:check` against `scripts/perf-baseline.json`                         |
| `eslint-plugin-react-native-a11y`         | Held     | latest (3.5.1) peers eslint ≤8; until a release peers eslint 10, `src/test/a11y.ts` guards every interactive primitive |
| EAS Update Hermes bytecode diff           | Defer    | opt-in beta; follow Expo release notes                                                                                 |
| Navigation test mocks, FSD `hooks/` split | Defer    | add when routing assertions appear; revisit if `src/hooks/` grows past a handful of entries                            |

- **Status**: in force. **Evidence**: [62675e6](https://github.com/Vadymk95/template-rn/commit/62675e6), [PR #45](https://github.com/Vadymk95/template-rn/pull/45).

## React Compiler silent-bailout awareness

- **Decision**: keep `experiments.reactCompiler: true`, `eslint-plugin-react-compiler` and `eslint-plugin-react-hooks` 7 (rules-of-hooks and exhaustive-deps come through `eslint-config-expo`). `npm run verify:rc` (`react-compiler-healthcheck src`) is an opt-in audit, outside the gate. The escape hatch for a bailout that causes an observable regression is a file-level `"use no memo"`.
- **Consequences**: `reactHooks.configs['recommended-latest']` is not wired: `eslint-config-expo` bundles an older `react-hooks` instance, so the v7-only rules do not resolve under flat config. Two upstream bugs can make the Compiler skip memoization silently: [facebook/react#35105](https://github.com/facebook/react/issues/35105) (`eslint-disable` suppresses the incompatible-library warning) and [#35644](https://github.com/facebook/react/issues/35644) (silent bailout with try/catch/finally in a component body). Drop this awareness once both are closed.
- **Status**: in force. The web siblings do not enable the Compiler (a Vite/Babel conflict and no ruled-out reproducer); this repo does.
- **Evidence**: [31a9d36](https://github.com/Vadymk95/template-rn/commit/31a9d36), [9c3f78e](https://github.com/Vadymk95/template-rn/commit/9c3f78e).

## REJECT list: explicit non-adoption

Read before proposing a tool that was already considered.

| Tool                                | Status         | Why                                                                                                                            |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| memlab (Meta heap-snapshot)         | skip           | no published GitHub releases and no flagship CI use; adopt only after an observed memory-leak class bug                        |
| why-did-you-render                  | skip           | its README declares it incompatible with the React Compiler; use the React DevTools Profiler and React 19.2 Performance Tracks |
| react-native-flipper                | sunset         | deprecated in RN 0.73 and removed from the boilerplate in 0.74; React Native DevTools replaces it                              |
| `@shopify/react-native-performance` | deprecated     | archived upstream 2025-11-26 with no named successor; see the observability entry                                              |
| Zstd compression plugin             | not applicable | Metro and Hermes ship JS, not an HTTP origin; Brotli stays the web default                                                     |
| `react-native-accessibility-engine` | skip           | last release 2022-11-15, and it peers `react-test-renderer`, which React 19 deprecates; evaluated 2026-10-09                   |

- **Status**: in force. **Evidence**: [31a9d36](https://github.com/Vadymk95/template-rn/commit/31a9d36).
