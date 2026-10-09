# DECISIONS — Why these, not others

History lives in `git log -p -- .cursor/brain/DECISIONS.md` and the linked PRs; this file holds only what is true today (entries ≤30 lines: context, decision, consequences, status, evidence), and a reversed decision is rewritten or deleted here, never archived.

## Index

| Decision                                                               | Date    | Status                                 |
| ---------------------------------------------------------------------- | ------- | -------------------------------------- |
| Expo managed over bare React Native                                    | 2026-04 | in force                               |
| Expo Router over React Navigation standalone                           | 2026-04 | in force                               |
| Expo SDK 57 baseline                                                   | 2026-07 | in force; SDK 58 held                  |
| NativeWind 4.2 on Tailwind 3.4, not v5                                 | 2026-04 | in force; version hold                 |
| Dependencies: the SDK list is the authority, holds are data            | 2026-10 | in force                               |
| Override floors with major caps, dated allowances                      | 2026-10 | in force; allowances expire 2026-11-02 |
| ESLint 10 and `eslint-config-expo`                                     | 2026-07 | in force                               |
| Oxlint before ESLint                                                   | 2026-04 | in force                               |
| 4-space indent, single quotes                                          | 2026-04 | in force                               |
| Jest and jest-expo, not Vitest                                         | 2026-04 | in force                               |
| Jest coverage thresholds and exclusions                                | 2026-04 | in force                               |
| Gate-script specs run on `node:test`                                   | 2026-07 | in force                               |
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

## Dependencies: the SDK list is the authority, holds are data

- **Context**: `npm outdated` names versions the installed SDK does not support; taking them breaks Expo Go and the `jest-expo` pairing. `.npmrc` carries `min-release-age=3` (a release younger than three days is refused) and `ignore-scripts=true`.
- **Decision**: native package versions come from the installed `expo`'s `bundledNativeModules.json` (`npx expo install --check` / `--fix`), never from `npm outdated`. Every package held below a newer release is one entry in `scripts/version-holds.json` (range, reason, lift condition, evidence); `check-version-holds.mjs` runs in `verify` and fails when `package.json`, the lockfile or `.github/dependabot.yml` disagree with it.
- **Consequences**: `expo install --check` and `expo-doctor` can go red for a patch the cooldown still refuses; wait for the age to pass. The cooldown is lowered only by an operator decision for one install, recorded in that PR; `.npmrc` itself stays. `yaml` is a devDependency only to satisfy `postcss-load-config`'s optional peer (the hoisted `yaml@1` from `@expo/ngrok` made `npm ls --all` exit 1); nothing imports it, drop it when that peer goes.
- **Status**: in force. A hold is lifted by its own condition, checked when a Dependabot PR or an upstream release arrives, not on a calendar.
- **Evidence**: [PR #44](https://github.com/Vadymk95/template-rn/pull/44), [aa1f7de](https://github.com/Vadymk95/template-rn/commit/aa1f7de).

## Override floors with major caps, dated allowances

- **Context**: a transitive advisory with a fixed release is closed with a root `overrides` floor; npm's own suggested fix was once a semver-major downgrade of `eslint-config-expo`, which is destructive. Our own uncapped floors (`brace-expansion`, `fast-uri`) aged into later advisories' vulnerable ranges.
- **Decision**: every floor carries a major cap (`">=fixed <next-major"`), and two majors need two floors keyed by major (`"js-yaml@^3"` and `"js-yaml@^4"`; the parent-scoped form made `npm ls --all` flaky). An advisory with no fixed release anywhere gets a dated entry in `scripts/audit-allowlist.json` (`id`, `expires`, `reason`, `upstream`), not a floor.
- **Consequences**: `node-forge` (GHSA-86w9-cpqp-85rv, no patched release; reached through `expo-updates` and `@expo/cli`, which parse no attacker-supplied RSA signature in a shipped app) and `braces` (GHSA-vfj7-8cjw-p6xm) are allowed until 2026-11-02. At expiry, check `npm view <pkg> versions` and the upstream chain for a release past the vulnerable range; re-date only with a fresh reading. The `audit:gate` guard prints each allowance on every run and fails an expired or stale one.
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
- **Decision**: raw hex (`no-restricted-syntax`, string and template-literal selectors) is an error under `src/**` except `src/shared/lib/theme/**`; `@typescript-eslint/no-magic-numbers` is on with `-1 0 1 2 100 1000` plus enum members, array indexes, defaults and type indexes allowed, exempt in `src/shared/lib/theme/**`, root config files and tests (a test that imports the constant it asserts is tautological). `no-empty` is on with `allowEmptyCatch: false`.
- **Consequences**: the tab bar tint now reads `useColorScheme()` and `getThemeColorValue`; `src/test/app/tabs-layout.test.tsx` guards it with a file-local `expo-router` mock, because the shared mock drops props.
- **Status**: in force. **Evidence**: [6fbe2ae](https://github.com/Vadymk95/template-rn/commit/6fbe2ae), [4ae66e3](https://github.com/Vadymk95/template-rn/commit/4ae66e3) ([PR #38](https://github.com/Vadymk95/template-rn/pull/38)).

## Native colour values mirror `global.css`

- **Context**: `COLOR_VALUES` (`src/shared/lib/theme/colors.ts`, hex) and the CSS variables in `global.css` (HSL) are hand-maintained in two files, and three values had already drifted.
- **Decision**: `global.css` (the shadcn/ui palette) is the source of truth. `colors.test.ts` converts every duplicated CSS variable to hex and asserts it against the matching `COLOR_VALUES` entry, light and dark.
- **Status**: in force, guarded by that test. **Evidence**: [PR #38](https://github.com/Vadymk95/template-rn/pull/38).

## The gate contract: `verify` is a superset of CI

- **Decision**: `verify` is every check that works offline; `verify:ci` is `audit:gate` plus `verify` (the audit is the only check that needs the network). The Husky pre-push hook runs `verify:ci`, and the CI job runs it as a single step; `ci:local` adds `expo-doctor`. A new check goes into the script, never only into a workflow file, so a green local run predicts a green pipeline (three sibling templates once broke exactly this).
- **Consequences**: the tier law (which checks run when) is in `AGENTS.md` § the gate and `scripts/gate-tiers.json`. Not in the gate: Maestro flows (`.maestro/`, `npm run maestro`) need a simulator or device, and `expo-doctor` reads live SDK state and can go red with no code change, so it is `continue-on-error` in CI.
- **Status**: in force. **Evidence**: [4a29b21](https://github.com/Vadymk95/template-rn/commit/4a29b21).

## Fail-closed audit gate

- **Context**: `npm audit --audit-level=high` passes when it cannot run (unreachable registry, auth failure, offline runner); a security gate that succeeds when it did not run is worse than none.
- **Decision**: `scripts/audit-gate.mjs` fails on an un-allowlisted high or critical advisory, an expired allowance, a stale allowance (its advisory no longer appears, so allowances cannot accumulate) and its own inability to complete. `evaluateAudit` is pure and `scripts/audit-gate.test.mjs` covers all four branches. An override floor is preferred; an allowance is the last resort (see the override-floor entry).
- **Status**: in force. **Evidence**: [4a29b21](https://github.com/Vadymk95/template-rn/commit/4a29b21).

## `docs:check` guards CI steps, ruleset contexts and its own trigger

- **Decision**: `docs:check` fails when a `run:` step in a PR-triggered workflow is not declared in `scripts/gate-tiers.json` § `ci.allowedRunSteps` (a check that runs only in CI, outside `verify`; block scalars are read line by line), and when a required status check in `.github/ruleset.json` is produced by no workflow job (job `name:` or id, plus matrix values) nor listed in `ci.rulesetContextAllowlist`. A job whose context GitHub renders only at runtime prints one non-failing line. The pre-commit hook runs `docs:check` whenever the staged set touches docs, rules, `.github/`, `scripts/docs-check.*`, `scripts/gate-tiers.json` or `package.json`.
- **Consequences**: `scripts/docs-check.mjs` is byte-identical across the four templates; this repo's data is in `gate-tiers.json`.
- **Status**: in force. **Evidence**: [PR #36](https://github.com/Vadymk95/template-rn/pull/36), [PR #38](https://github.com/Vadymk95/template-rn/pull/38).

## TDD sibling gate on pre-commit, no auto-commit hook

- **Decision**: `scripts/check-test-siblings.mjs` refuses a commit when a staged `src/**` file has no co-located `*.test.*`. It checks staged files only, a ratchet: existing untested files are not retroactively broken, the next edit to one needs a test. Its exempt list derives from this repo's `collectCoverageFrom` plus declaration-only modules; `src/shared/lib/theme/**` is not exempt. The hook proves existence, never worth: the mutation check (revert the fix, the test must go red) lives in `test-driven-development.mdc`.
- **Consequences**: pre-commit also runs repo-wide `lint:oxlint`, `format:check` and `typecheck`, collecting all failures before deciding, because `lint-staged` restores the unstaged hunks of a partially staged file after fixing it. Not adopted: a hook that commits for you, which hides a formatting fix inside a commit nobody wrote; the hook prints the remedy (`npm run fix && git add -u`) instead.
- **Status**: in force. **Evidence**: [88f5551](https://github.com/Vadymk95/template-rn/commit/88f5551).

## Complexity ratchet

- **Context**: the thresholds come from a measurement of the tree (p95 complexity 5, one outlier at 20), not taste; an early threshold was derived from a truncated probe output and the gate caught the error on its first full run.
- **Decision**: five ESLint core rules gate `src/**` excluding tests: `complexity` 15, `max-depth` 3, `max-params` 4, `max-lines-per-function` 120, `max-lines` 200. `shared/ui/Button/Button.tsx` carries a file-scoped override pinned at its measured 20, so it cannot absorb growth. Tests are exempt on purpose: a `describe` block is one function to these rules and table-driven suites are long by design.
- **Consequences**: when a threshold fires, split the function; raising a number needs a fresh measurement and an edit of this entry. `eslint.config.mjs` cites this entry.
- **Status**: in force. **Evidence**: [310238b](https://github.com/Vadymk95/template-rn/commit/310238b), `eslint.config.mjs`.

## Mutation testing: weekly strength gate, outside `verify`

- **Context**: coverage cannot tell whether tests would catch a wrong implementation; the first baseline, 53.72%, sat under green 80/60/80/80 coverage floors.
- **Decision**: `npm run test:mutation` (StrykerJS with the Jest runner, `projectType: "custom"`, which reads the `package.json` Jest config; works with `jest-expo` unmodified) runs weekly through `mutation.yml` (cron and dispatch). `thresholds.break: 48` in `stryker.config.json` is a floor of record: raise it after a good run, never lower it to go green. Not in `verify` or pre-push (a full run takes minutes).
- **Consequences**: the score sees only the kill side (it cannot see an over-strict test) and purely visual mutants (those belong to `.maestro/`). `.stryker-tmp` and `reports` are ignored by git, prettier and ESLint, and `.env*` stays out of Stryker's sandbox through `ignorePatterns`, because a crashed run once left a sandbox that reddened an unrelated push. The runner's tree is inside the audit gate: a high advisory there gets an override floor, not an allowance.
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
- **`expo-doctor` as a blocking step**: it can go red with no code change; it stays `continue-on-error` in CI and `ci:local`, never in `verify`.
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

- **Decision**: keep `experiments.reactCompiler: true`, `eslint-plugin-react-compiler` and `eslint-plugin-react-hooks` 7 (rules-of-hooks and exhaustive-deps come through `eslint-config-expo`). `npm run verify:rc` (`react-compiler-healthcheck src`) is an opt-in audit, not part of `verify` or `ci:local`. The escape hatch for a bailout that causes an observable regression is a file-level `"use no memo"`.
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

- **Status**: in force. **Evidence**: [31a9d36](https://github.com/Vadymk95/template-rn/commit/31a9d36).
