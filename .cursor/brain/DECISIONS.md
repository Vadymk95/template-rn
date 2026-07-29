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

## Expo SDK 57 baseline (upgraded 2026-07-16; was SDK 55)

- SDK 57 with React Native 0.86 + React 19.2; upgrade path 55→57 executed via
  `npx expo install expo@^57 --fix` (see "Deferred: SDK 56 migration" below for
  the resolved blockers).
- Legacy Architecture was **dropped** in SDK 55 — New Arch is the only option,
  so `newArchEnabled: true` is no longer a meaningful flag.
- React Compiler is stable, wired via `experiments.reactCompiler: true`.
- SDK 56 breaking changes absorbed in passing: expo-router decoupled from
  react-navigation (no direct imports existed), `expo/fetch` as global default
  (no manual imports existed), top-level `splash` config key removed (plugin
  config was already present).

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

## ESLint 10 + `eslint-config-expo` (supersedes the ESLint 9 pin)

- **ESLint 9 reached end of life**, so the pin was not a stable position — it was a
  countdown. The blocker that motivated it is real but has a one-line fix, so the
  pin is gone.
- **The blocker**: `eslint-config-expo` sets `settings.react.version: 'detect'`.
  Under ESLint 10 the detection path in `eslint-plugin-react` calls the removed
  `context.getFilename()`, and every React rule throws while loading —
  `Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`.
- **The fix**: a trailing config object in `eslint.config.mjs` that sets
  `settings.react.version` to a **literal** (`'19.2'`). It carries no `files` key,
  so it applies everywhere, and being last it wins over the Expo preset. Removing
  it reproduces the crash — verified, it is load-bearing rather than decorative.
- Two plugins arrive transitively through `eslint-config-expo` with an `eslint`
  peer capped below 10 — `eslint-plugin-react` (`^9.7`) and `eslint-plugin-import`
  (`^9`). Both are mapped to the installed ESLint through root `overrides`
  (`{ "eslint": "$eslint" }`) rather than with `--legacy-peer-deps`, which would
  disable peer resolution for the whole tree. `eslint-plugin-jsx-a11y` is not
  installed here, so unlike the web templates it needs no entry.
- Type-aware `typescript-eslint` rules stay scoped to **`src/**`** so `app.config.ts` and other root tooling stay outside the type-aware project surface.
- **`eslint-plugin-oxlint` is deliberately NOT installed** in this repo: the two
  linters are run as separate passes and no rules are auto-disabled from the oxlint
  side, so `oxlint` has no lockstep partner and can be bumped on its own.

## The gate contract: `verify` is a superset of CI

- `verify` = every check that works **offline**. `verify:ci` = `audit:gate` + `verify`,
  and `audit:gate` is the only check that needs the network. Husky pre-push runs
  `verify:ci`; the CI job runs `verify:ci` as a **single step**.
- **A new check goes into the script, never only into the workflow file.** A check
  that lives only in `.github/workflows/ci.yml` breaks the one property the gate is
  for: that a green local run predicts a green pipeline. Three sibling templates had
  exactly that defect before this pass.
- `ci:local` = `verify:ci` + `expo-doctor`, so the full pipeline including live SDK
  health can be reproduced locally in one command.

## Fail-closed audit gate instead of bare `npm audit`

- `npm audit --audit-level=high` **passes when it cannot run** — an unreachable
  registry, an auth failure or an offline runner all produce a non-report that a
  naive exit-code check reads as clean. A security gate that succeeds when it did
  not run is worse than no gate.
- `scripts/audit-gate.mjs` therefore fails closed on four conditions: an
  un-allowlisted high/critical advisory, an **expired** allowance, a **stale**
  allowance (one whose advisory no longer appears — so allowances cannot accumulate
  silently), and its own inability to complete. Every allowance carries a reason, an
  upstream status and a hard `expires` date.
- `evaluateAudit` is a pure function so the policy is unit-testable without hitting
  the network; `scripts/audit-gate.test.mjs` covers all four branches.
- **The allowlist is currently empty, and that is the target state.** The two high
  advisories the tree had were closed with root `overrides` rather than allowances:
  `brace-expansion >=5.0.8` (`GHSA-mh99-v99m-4gvg`, reachable only through
  `minimatch@3`, which several lint and Jest 29 dependencies pin) and
  `fast-uri >=3.1.4` (`GHSA-v2hh-gcrm-f6hx`). npm's own suggested remediation for
  the first was `eslint-config-expo@6.0.0` — a semver-major **downgrade** from 57,
  destructive rather than a fix. Prefer an override; reach for an allowance only
  when no compatible version exists.

## Role commands in `.claude/commands/`, pointers in `.cursor/commands/`

- Five commands, each turning the agent into a ROLE with this repo's own gate, danger zones and test
  infrastructure named inside: `onboard`, `feat`, `test`, `review`, `docs`. A generic prompt would make the
  agent rediscover the repo every session; these name `src/test/setup.ts`, the FSD layers, the
  `EXPO_PUBLIC_` surface and `expo-secure-store` directly.
- `.cursor/commands/*.md` are **thin pointers** to the canonical `.claude/` file — the same shim pattern as
  `CLAUDE.md` → `@AGENTS.md`. Not copies (two files drift) and not symlinks (fragile on Windows).
- `.claude/` is ignored both locally and by the global ghost-mode ignore, so the tracked path needs the
  ladder `!.claude/` → `!.claude/commands/` → `!.claude/commands/**`: git will not descend into an ignored
  directory to find a negation inside it. `settings.local.json` and `settings.json` stay untracked —
  machine-specific paths and per-machine permission grants do not belong in a template.
- Cursor resolves personal commands before project ones, so an operator with their own
  `~/.cursor/commands/{feat,test,review}.md` shadows the repo copies there. `onboard` and `docs` are
  unshadowed. In Claude Code the repo copies win.
- `/onboard` closes with a one-line menu of the other four. The operator asks for work in prose rather than
  typing commands, so the moment right after orientation is the only place that list is useful.

## Deliberately NOT adopted from the sibling web templates

The four templates share one harness standard, so an absence here should be readable as a decision rather
than as an oversight.

- **Tailwind class-hygiene lint rules** (`tailwindcss/no-contradicting-classname` and the rest of the
  four-rule subset). Those plugins read a Tailwind **v4** CSS config (`@theme` in a stylesheet); this repo
  is NativeWind 4.2 on **Tailwind 3.4** with a JS config, which is a recorded version hold, not a lag. The
  rules do not apply and adding them would either no-op or misreport. Revisit only together with
  NativeWind 5.
- **`SECURITY_REQUIREMENTS.md`.** In the web templates it is entirely HTTP response headers, CSP and nonce
  injection. A React Native app serves no document and has no CDN in front of it, so the checklist has no
  target. The equivalent surface here is `EXPO_PUBLIC_*` being public, `expo-secure-store` versus
  plaintext AsyncStorage, `app.config.ts` permissions and `extra`, deep links as untrusted input, and EAS
  secrets — covered in `.cursor/brain/SECURITY_REVIEW.md`, `.github/copilot-instructions.md` and the
  `/review` command.
- **e2e in the gate.** Maestro flows live under `.maestro/` and run via `npm run maestro`, but they need a
  simulator or device, so they cannot be part of an offline `verify`. The web templates put Playwright in
  the gate because a headless browser is available on a CI runner; a device is not.
- **`expo-doctor` as a blocking step.** It reads live SDK and package state and can go red with no code
  change. It stays `continue-on-error` in CI and inside `ci:local`, never inside `verify`.

## Legacy `.cursorrules` deleted

- The single-file `.cursorrules` format is superseded by `.cursor/rules/*.mdc`, which Cursor loads with
  globs and priorities. Keeping both meant two places to update and a silent authority question.
- Every line of it was verified present elsewhere before deletion: authority order in `global.mdc` and
  `AGENTS.md`, the Ghost principle and the six-phase pipeline in `agent-pipeline.mdc`, the style policy in
  `engineering-standards.mdc` and `react-patterns.mdc` (including the `FC`-alias ban), the FSD map in
  `fsd-layers.mdc` (including the one `global.css` relative-import exception), verification in
  `VERIFICATION.md` and `workflow.mdc`, the language split in `global.mdc`.

## TDD sibling gate on pre-commit, and no auto-commit hook

- `scripts/check-test-siblings.mjs` refuses a commit when a staged `src/**` file has no
  co-located `*.test.*` sibling. It checks **staged files only**, which makes it a
  ratchet: the existing untested files are not retroactively broken, but the next edit to
  one requires a test. That is deliberate — a gate that fails on day one gets disabled.
- The exempt list is derived from THIS repo (Jest's `collectCoverageFrom` exclusions plus
  declaration-only modules), not copied from a sibling template. `src/shared/lib/theme/**`
  is **not** exempt: it is in the coverage report and `colors.ts` exports a real function
  whose dark branch is uncovered.
- The hook proves _existence_, never worth. The mutation check — revert the fix, the test
  must go red — is in `test-driven-development.mdc` because a hook cannot do it.
- **The pre-commit hook also runs a repo-wide `lint:oxlint` + `format:check`, collecting
  both failures before deciding.** `lint-staged` fixes the staged hunks and then restores
  the unstaged hunks of a partially staged file, which is exactly how "already formatted,
  never committed" files kept appearing. Both checks run so one attempt reports
  everything rather than one problem at a time.
- **Not adopted: a hook that commits for you.** It was considered as the fix for the
  dangling-formatted-files problem. A hook that creates commits hides what it changed
  inside a commit nobody wrote, and its failure mode is a formatting fix landing under an
  unrelated subject. The hook refuses and prints the one-line remedy
  (`npm run fix && git add -u`) instead.

## Raw hex and magic numbers are lint errors, not review notes

- Both were already written down as conventions and neither was enforced, which is
  the state where a rule quietly stops being true. The tab bar tint proved it: a
  copied literal `#0a0a0a` sat in `navigationTheme.ts` next to a comment saying "do
  not sprinkle raw hex in layouts", while the token it claimed to mirror was
  `#09090B`. Enabling the rule surfaced it; the constant is gone and
  `(tabs)/_layout.tsx` now derives the value from the token table instead.
- **Raw hex** (`no-restricted-syntax`, string AND template-literal selectors) is
  blocked everywhere under `src/**` except `src/shared/lib/theme/**`, which is where
  colours are defined. Tests are exempt.
- **`@typescript-eslint/no-magic-numbers`** is on across `src/**` with `-1 0 1 2 100
1000` plus enum members, array indexes, default values and type indexes allowed.
  Exempt: `src/shared/lib/theme/**` (there the number is the definition), root config
  files, and tests. Tests are exempt on purpose — a test that imports the constant it
  asserts is tautological, so pinning the literal is the correct thing to do there.
- The limitation the lint rule exposed was then fixed on its own merits: the tab bar
  tint was the LIGHT value regardless of scheme, so the active tab was near-black on a
  near-black bar in dark mode. `(tabs)/_layout.tsx` now reads `useColorScheme()` and
  calls `getThemeColorValue`, matching how every `shared/ui` component already resolves
  a real colour value. `src/test/app/tabs-layout.test.tsx` guards it by capturing
  `screenOptions` from a file-local `expo-router` mock — the shared mock drops props,
  so a test written against it would have passed whatever the layout did. Verified by
  mutation: restoring the fixed light value turns the dark-scheme case red.

## Secret scan and CodeQL, with the plan boundary written down

- `security.yml` runs **gitleaks** (full commit history, its own scanner, works on any
  plan) and **CodeQL** with the `security-extended` pack plus a weekly cron. Weekly
  matters: a CVE published mid-week would otherwise wait for the next push.
- **CodeQL needs GitHub code scanning, which is free on public repos and paid on
  private ones.** This repo is public. A private fork gets HTTP 403 from the upload
  step; the answer is to enable Advanced Security or delete the `codeql` job, never to
  weaken the workflow. That is a plan boundary, not a misconfiguration, and it is
  stated in the workflow header and the README so nobody rediscovers it from a red run.
- `ios/` and `android/` are generated by `expo prebuild` and never committed, so
  CodeQL's tree contains no native code here. That is a property of the managed
  workflow, not an exclusion list — no `paths-ignore` is needed and none is present.
- The gitleaks action is **SHA-pinned**. Action tags are mutable and have been
  retargeted in supply-chain attacks; Dependabot's `github-actions` ecosystem keeps
  the pin fresh.

## Gate-script specs run on `node:test`, not Jest

- The gate scripts are executable ESM (`.mjs`). Jest 29 does not discover that
  extension and does not load real ESM without `--experimental-vm-modules`, so
  wiring them into the Jest run would mean config surface for tooling tests.
- `npm run test:scripts` = `node --test "scripts/**/*.test.mjs"` — no config, and it
  keeps gate tooling out of `collectCoverageFrom`. That second property matters: in
  a sibling template, folding gate scripts into the app's coverage run dropped line
  coverage from 93% to 82% without a line of app code changing.
- The glob is quoted so **Node** expands it. An unquoted `scripts/*.test.mjs` relies
  on the shell, which does not glob on Windows, and a bare `scripts/` directory
  argument is resolved as a module path and fails with `MODULE_NOT_FOUND`.

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

**Status**: RESOLVED 2026-07-16 — migrated straight to SDK 57. Every root cause below was addressed exactly as predicted: (1) `"types": ["jest", "node"]` added to tsconfig (jest globals restored), (2) top-level `splash` removed in favour of the existing `expo-splash-screen` plugin config, (3) `TabIconProps.color` widened to `ColorValue`, (4) RNTL 14 async API migration (render/fireEvent/act/unmount awaited) + index-signature bracket access in tests. Full gate green (verify + expo-doctor 20/20). Historical record below kept as-is.

**Original status**: attempted 2026-05-23, REVERTED to SDK 55 due to surfacing **360 TypeScript errors** during typecheck — root causes include `expo/tsconfig.base` SDK 56 no longer auto-injecting Jest globals (`expect`/`describe`/`it` lost), `ExpoConfig.splash` field migration, Expo Router v56 stricter `TabIconProps` typing (ColorValue vs string), and React Native 0.85 strict index signatures on accessibility/className props. Migration ran cleanly per `expo install --fix` + `expo-doctor` 18/18, but tsc strict-typecheck broke at scale. Not a 5-min fix.

**Deferred until**: dedicated session with budget for migration walkthrough — (1) `"types": ["jest"]` add to tsconfig OR `@types/jest` realignment, (2) `app.config.ts` splash field migration to `expo-splash-screen` plugin config, (3) `(tabs)/_layout.tsx` TabIconProps type widening or import `ColorValue` from `react-native`, (4) RN 0.85 index-signature audit (add `[key: string]: unknown` or explicit prop typing per offending component), (5) NativeWind className typing reconciliation.

**Revisit when**: time budget ≥2h available for surgical migration + verification pass.

## [2026-05] Boundary validation via Zod safeFetch wrapper (mobile-aware)

**Decision**: validate ALL API responses at boundary using Zod schemas via `src/lib/api/safeFetch.ts`. Reference example: `src/lib/api/_exampleSafeQuery.ts` (template seed). Pattern adopted as template seed because mobile distribution lag amplifies BE-drift impact (see Why).

**Why (mobile-specific)**:

- Cannot push hotfix instantly — App Store review delays days-to-weeks. Play Store faster but still hours.
- EAS Update OTA improves this but only for JS bundle changes (not native).
- BE schema drift in production = bug in user hands BEFORE patch reaches them.
- `safeFetch` parses on every read → graceful degradation surface (catch SchemaValidationError → show "data unavailable" instead of NaN/blank UI).

**Scope**:

- TanStack Query `queryFn` → `safeFetchQueryFn(url, schema)` (re-throws AbortError unchanged → TQ treats as cancellation, not error)
- Direct fetch → `safeFetch(url, schema)`
- AsyncStorage reads → `Schema.safeParse(JSON.parse(raw))` (similar drift risk on app upgrade cycle)
- expo-secure-store reads → same pattern

**Pairs with**: `src/lib/logger.ts` — wire SchemaValidationError handler to log.error('[api] schema drift') so Sentry RN captures it (per Sentry RN integration ADR).

**Trade-offs**: +0 KB bundle (Zod in deps), ~50-200μs parse per response (negligible vs network latency).

**When NOT to use**: tRPC end-to-end codegen, throwaway prototypes, internal in-app function calls.

**Revisit trigger**: if consumer fork drops safeFetch from 3+ endpoints OR adds tRPC codegen → drop from template seed.

## [2026-05] Magic strings → constants (Zustand keys + Query factory + secure-store keys)

**Decision**: extract magic strings used in 2+ places OR carrying external contract to named constants. Apply selectively per scope rules. NOT blanket extraction.

**Extraction sites added this commit**:

- `src/lib/storageKeys.ts` — `STORAGE_KEYS` (Zustand persist names, AsyncStorage external contract) + `SECURE_STORAGE_KEYS` (expo-secure-store keys, separate object for security boundary clarity). Mobile context: renaming a key without migration = silent loss of user data on app update. `src/store/user/constants.ts` was retired into this file (single export `USER_PERSIST_STORAGE_KEY` → `STORAGE_KEYS.userPersist`).
- TanStack Query key factory **NOT centralized** — `src/lib/api/_exampleSafeQuery.ts` already demonstrates the per-feature factory pattern (`exampleKeys`), and `src/lib/queryClient.ts` JSDoc + `PROJECT_CONTEXT.md` Query-extension table both mandate `src/features/<name>/api/<name>Keys.ts` as the convention. A central `src/lib/queryKeys.ts` would contradict the existing ADR — re-evaluate if cross-feature key collisions appear.

**Pattern**: `as const` objects, NOT `enum`. Type via `typeof OBJ[keyof typeof OBJ]`. Vocabulary tokens in `src/shared/lib/constants/**` + `src/shared/lib/theme/**` are SEPARATE (vocabulary, NOT call-site-counted, per existing "Design tokens are vocabulary" ADR).

**Mobile-specific rationale**: cannot push hotfix instantly. Storage key rename without migration code = silent data loss for existing users (their AsyncStorage / SecureStore values become orphaned). Constants = single-source rename + grep-able audit. The Secure vs Async split mirrors the threat model: plaintext on disk vs Keychain/EncryptedSharedPreferences.

**When NOT to extract**: single-use, logger tags, i18n keys, vocabulary tokens (`TYPOGRAPHY_TOKENS` / `SPACING_TOKENS` / declarative tables stay), testIDs, prototype scope. `TODO_FILTERS` (`src/store/todo/constants.ts`) stays co-located with its entity — domain enum, not external contract.

**Revisit trigger**: if consumer fork adds >3 stores or >5 query keys without using factories within 60 days, drop pattern from template seed.
