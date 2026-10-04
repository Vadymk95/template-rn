# DECISIONS — Why these, not others

Short record of non-obvious trade-offs. Update when reversing a decision.

## [2026-10] External-lens fixes: SHA-pinned actions, scoped tokens, a cleartext guard (2026-10-04)

**Every GitHub Action is SHA-pinned since 2026-10-04.** Each `uses:` in the workflows names a full
commit SHA with the version in a trailing comment, the same version the floating tag pointed at that
day; the gitleaks action was the only pinned one before. GitHub's immutable releases lock only a
release's own tag, and only when the publisher opts in, so a floating `@vN` tag stays movable while a
SHA cannot be retargeted. Dependabot's `github-actions` ecosystem updates a pin and its comment
together, so the price is review noise, not maintenance.

**Workflow tokens default to `contents: read`.** `release.yml` keeps its write scopes (`contents`,
`issues`, `pull-requests`) on the one `release-please` job; `security.yml` gained a top-level
`permissions: contents: read` and its jobs keep their own scopes. No job's effective permissions
changed.

**`app.config.ts` cannot enable cleartext HTTP unnoticed.** `scripts/native-config.test.mjs` reads the TEXT of
`app.config.ts` and of the files directly under a local `plugins/` directory (if there is one; subdirectories are
not scanned), and fails on every line that names `usesCleartextTraffic`, `NSAllowsArbitraryLoads`,
`NSExceptionAllowsInsecureHTTPLoads` or `NSTemporaryExceptionAllowsInsecureHTTPLoads` once each plain
`<key>: false` (followed by `,`, `}`, a `//` comment or the end of the line) is removed from it, so
`false || IS_DEV` and a conditional spread are findings. A mention in a comment counts too: reword the comment,
or add an allowance. `scripts/native-config-allowlist.json` is an array of
`{ key, reason }`; an allowance covers its key in every scanned file. It fails closed like the audit gate: a file
that is not an array, an entry with an unknown key or a blank reason, and a stale entry (a key with no finding,
so a key that only occurs as `: false` leaves its entry stale) all fail. It is a `node:test` spec inside
`test:scripts`, so it adds no gate step.

_Why plain text._ The one threat is a developer or an AI agent switching cleartext on for local development, in
any form: a literal, a value gated on an env var, a key inside a function plugin. Nothing is evaluated, parsed or
followed, so a condition cannot hide the value and a fork inherits one small file, not a test machine.
Evaluating the config for each env value, blanking comments and following imports were all dropped: each is
test code a fork must carry, for a threat this plain.

_Out of scope, stated rather than hidden._ Deliberate obfuscation (unicode escapes, a key built from strings,
tricks with comments or escaped quotes); a file outside `app.config.ts` and the files directly under `plugins/`
(a subdirectory of `plugins/`, an import from elsewhere, `node_modules`); a static `app.json` (this template has
none).

_Proof, 2026-10-04._ A cleartext key injected into the real `app.config.ts` (gated on an env var) and into a file
under `plugins/` turned the real-file test red.

**Four unused dependencies were removed:** `expo-application`, `expo-device`,
`react-native-edge-to-edge` and `react-native-svg`. Checked 2026-10-04: a repo-wide grep (code,
`app.config.ts` plugins, docs) found no reference outside this entry, and a scan of all 1579 installed
`package.json` files, nested `node_modules` included, found no `dependencies`, `peerDependencies` or
`optionalDependencies` entry naming the first three. For `react-native-svg` the scan found two mentions
that need nothing installed: `react-native-css-interop` lists it only in `peerDependenciesMeta` as
optional (not a declared peer, and its `dist` never references it), and `react-native-reanimated` lists it
in `devDependencies`, which consumers do not install. Add one back with `npx expo install <name>` the day
a feature needs it.

## [2026-10] delta audit fixes

A second audit round closed three silent holes and fixed three real doc ↔ code contradictions.

**`no-empty` was not enabled** — `eslint.config.mjs` had no rule for a swallowed catch. Added
`'no-empty': ['error', { allowEmptyCatch: false }]` next to `no-console`. Proven: a probe file
with an empty `catch {}` turns `error` red; `src/**` had no existing empty catch to fix (the five
real `catch` sites are either `.catch()` promise handlers or `safeFetch.ts`'s documented
graceful-degradation fallback). Checked and ported the same rule to `template-1`,
`template-spa-pwa` and `template-next-seo`, all of which were missing it too.

**The pre-commit `docs:check` trigger (`.husky/pre-commit`) missed the checker's own files** — the
`grep -qE` regex matched doc/rule/workflow paths but not `scripts/docs-check.*` or `package.json`,
so a broken checker or a renamed npm script could commit clean and surface only on the weekly CI
run. Added `|^scripts/docs-check\.|^package\.json$`. Proven: `scripts/docs-check.mjs` does not
match the old pattern (exit 1) and matches the new one (exit 0); same for `package.json`. Ported
to all four templates.

**`COLOR_VALUES` (`src/shared/lib/theme/colors.ts`) had drifted from `global.css`'s CSS
variables** — the two are hand-maintained in different files and different colour formats (HSL vs
hex), with no guard keeping them equal. Added `colors.test.ts` coverage that converts every
duplicated CSS variable to hex (the CSS Color 4 HSL→sRGB algorithm, not a hand-rolled
approximation) and asserts it against the matching `COLOR_VALUES` entry, light and dark. Proven:
mutating one role's hex turns that case red; restoring it is green.
**Writing the test surfaced three values that had already drifted, not hypothetically but today**:
`light.danger` (`#E11D48`, a rose) vs. the CSS `--destructive` (`#EF4444`, computed) — real, because
`COLOR_TOKENS.danger` is literally `'bg-destructive'`, i.e. the className and the native-value
tables were meant to be the SAME colour; `dark.danger` (`#FB7185`) vs. computed `#7F1D1D`, same
class of bug; and `dark.accentForeground` / `dark.dangerForeground` (`#09090B`, identical to
`dark.background` — a plausible copy-paste of the wrong token) vs. computed `#18181B` from
`--primary-foreground`. All three corrected to the CSS-derived hex, on the assumption that
`global.css` (the unmodified shadcn/ui default palette) is the source of truth and `COLOR_VALUES`
is the mirror that drifted — flagged for review rather than assumed silently. Visible effect: a
destructive `IconButton` no longer renders a rose icon on a red background/border.

**Doc fixes, no behaviour change:**

- `.cursor/brain/SKELETONS.md`'s `src/lib/queryClient.ts` entry claimed the `AppState` listener
  "must register at module load" and that moving it into a hook breaks foreground refetch. The
  code (and its own header comment) does the opposite by design: the subscription lives in
  `QueryClientAppStateBridge`, a component mounted once from `src/app/_layout.tsx`, specifically so
  it is NOT registered at module load and cleans up on unmount. Reworded to name the real risk
  (the bridge never mounting, or unmounting without remounting).
- `README.md`'s pipelines table listed `ci.yml → dependency-review` as a working check. No such
  job exists — `ci.yml`'s own comment records why it was removed (Dependency graph unavailable on
  this plan; the job could never pass). Removed the row.
- `.github/copilot-instructions.md` said "a list that can grow needs `FlatList` ..., not `.map()`"
  unconditionally, while the bundled `src/widgets/todo-workspace/TodoList.tsx` renders with
  `.map()`. Chose the smaller change: reworded the doc to scope the rule to lists with no
  practical ceiling, naming `TodoList` as the accepted `.map()` case, rather than rewriting
  `TodoList` onto `FlatList` (a real refactor touching its tests too).

## [2026-10] guard audit fixes

An audit sabotaged 73 guards in the sibling `template-1` and 53 caught the injected defect. F1 and
F2 apply here too (F3–F7 are web/t1/spa-specific and out of scope for this RN repo).

**F1 — `docs:check` flags a CI step that bypasses the gate.** New check derives every `run:` step
in a PR-triggered workflow — a single line or every non-empty line inside a `run: |`/`run: >`
block scalar, each reported at its OWN line — and compares it against `gate-tiers.json` §
`ci.allowedRunSteps`; anything else names the file:line and asks for it to move into `verify` or
be listed with a reason. `ci.allowedRunSteps` lists the two install steps, `verify:ci` itself, and
the advisory `npm run doctor` step (`continue-on-error: true`, Expo doctor, never blocks).
Replayed: an unlisted `npm run lint:extra` step, both on its own and inside a block scalar
alongside an allowed line, turned `docs:check` red on exactly that line; the current workflow
measures clean. (Review finding R1, 2026-10-03: the first cut skipped block scalars outright, the
most common way to write a multi-line step. Fixed by reading the block's own lines instead of
skipping them.)

**F2 — `docs:check` flags a ruleset context no workflow produces.** New check derives each job's
required-status-check name (its `name:` or id, plus matrix values from an inline `[a, b]` list or
a block `- value` list) from every workflow and compares it against `.github/ruleset.json`'s
`required_status_checks`; a mismatch names the file:line and asks for the job to be renamed back
or the context listed in `ci.rulesetContextAllowlist` with a reason. A job whose exact context
GitHub renders only at runtime (a matrix `include:`/`exclude:` key, or a `name:` carrying a
`${{ }}` expression) prints one loud, non-failing line instead, and only ruleset contexts starting
with that job's static base name are exempted from the strict comparison — not applicable to this
repo's single job, which has neither shape. This repo's `ci.yml` has one job, `verify`, named
`Typecheck, lint, test` — the ruleset context matches that `name:`, not the job id. Replayed:
renaming the job turned `docs:check` red; all three current contexts (the job, `Secret scan
(gitleaks)`, `CodeQL (JavaScript / TypeScript) (javascript-typescript)`) resolve to a real job.
(Review finding R2, 2026-10-03, shared with the sibling templates: the first cut read only an
inline matrix and had no notion of either undecidable shape — moot for this repo's one static job,
fixed for the siblings that do use matrices.)

`scripts/docs-check.mjs` stays byte-identical with `template-1`, `template-spa-pwa` and
`template-next-seo` (shared-file rule); the test file is `node:test`, not vitest, like the rest of
this repo's script tests, and `scripts/gate-tiers.json` § `ci` carries this repo's own
`allowedRunSteps` data.

## [2026-10] `brace-expansion` floor raised; `node-forge` allowed until 2026-11-02 (2026-10-02)

**`brace-expansion` floor raised, same entry, same cap.** `"brace-expansion": ">=5.0.9 <6"` aged into
three new high advisories published after it was written: `GHSA-q2hr-2g5m-vwhr` (quadratic-time
`{a},b}` expansion, fixed 5.0.12), `GHSA-qhr7-859c-m2p7` (unbounded recursion on nested brace groups,
fixed 5.0.11), `GHSA-6j4f-fj2g-mc7p` (unbounded recursion in `parseCommaParts`, fixed 5.0.10). Raised
to `">=5.0.12 <6"`, which clears all three; `npm ls brace-expansion` shows 5.0.12 everywhere.

**`node-forge` (`GHSA-86w9-cpqp-85rv`, high — RSA PKCS#1 v1.5 signature verification accepts extra
nested `DigestAlgorithm` elements) is allowed until 2026-11-02, not closed by a floor.**
`first_patched_version` on the advisory is `null`; the vulnerable range is `<=1.4.0` and 1.4.0 is the
newest version published to npm — there is no fixed release to float a floor to. Reaches this tree via
`expo-updates → @expo/code-signing-certificates → node-forge` and `expo → @expo/cli → node-forge`,
neither of which parses attacker-supplied RSA signatures at runtime in a shipped app. `npm`'s own
`fixAvailable` proposes downgrading `expo` to `44.0.6` (`isSemVerMajor: true`) — the exact wrong
remediation shape the override doctrine above warns about; not taken. This is the case the dated
allowance exists for (precedent: the `extract-zip` allowances in the sibling web templates, added
2026-08-25 for the same reason — no fixed release in any line). `scripts/audit-allowlist.json` carries
one entry, `id`/`expires`/`reason`/`upstream` matching that precedent's shape; `audit:gate` passes
(exit 0) and prints the allowance's reason and expiry on every run, so the gap stays visible rather
than silent. **Recheck at expiry (2026-11-02):** `npm view node-forge versions` for a release past
1.4.0, or an `expo-updates` / `@expo/code-signing-certificates` release that drops the dependency —
re-date with a fresh reading if neither exists.

## [2026-09] Agent limits in a committed `.claude/settings.json`; one Dependabot group; release token wired

**Decision**: `.claude/settings.json` is tracked and denies, in every permission mode: reading .env files
other than the example, editing itself, force pushes, `--no-verify`, `git reset --hard`, `git clean -f`; it
asks before edits of the gate files. The rule text lives in `AGENTS.md` § Lanes. Reopened on 2026-09-28 by
the owner's decision: the 2026-09-12 review had deferred it until an agent was seen editing a listed file,
and two public guides now name a deny list as the baseline of a professional agent setup.

**What it is not**: a security boundary. Per the Claude Code permissions docs, a Bash rule matches the
command as written, and `sh -c`, a full binary path or a `git -C` / `git -c` prefix walks past it; Read and
Edit denies cover the built-in file tools and the file commands Claude Code recognises in Bash (`cat`,
`head`, `tail`, `sed`, `tee`), not a script that opens the file itself nor `grep -r` run over the folder.
The boundary stays the required CI check. Cursor and Codex do not read the file.

**Review, 2026-09-28** (two adversarial passes before merge): a force push through a `+branch` refspec and
through a bundled `-fu` got past the first rules, both reproduced in a scratch repo, so `git push -f*`,
`git push *+*` and `git commit -n*` replaced the space-anchored forms. `-uf` and a trailing `-n` still get
through; more wildcards would start catching commit messages, so they stay documented, not chased. A claim
that deny rules lapse in `bypassPermissions` was checked and rejected: the permission-modes docs say deny
rules block in every mode, bypass included.

**Dependabot**: the production and development groups both rewrote `package-lock.json`, so the second PR
conflicted once the first merged (2026-09-27). One `minor-and-patch` group now carries every non-major
update; a major still opens its own PR.

**Release token**: `release.yml` passes `secrets.RELEASE_PLEASE_TOKEN || github.token`. With the secret
absent nothing changes (release PR runs wait in `action_required` for one approval); with a fine-grained
PAT in it, release PRs get CI like any other PR.

---

## [2026-09] Dependency pass: the SDK list is the authority, and the cooldown held three of its versions

**Decision**: bring every compatible dependency to its latest release in one pass, take Stryker 10, and let `npx expo install --check` decide native versions — never `npm outdated`. `npm update` moved the Expo packages inside their `~57.0.x` ranges and the transitive Metro / `@react-native/*` packages to fixed releases, which took the audit from 11 high to 0 and removed `image-size` from the tree entirely; both `image-size` allowances left `scripts/audit-allowlist.json` in the same commit (a stale allowance fails the gate by design).

**What the cooldown held**: `expo@57.0.20` and `expo-router@57.0.19` (published 2026-09-04) and `react-native@0.86.3` (published 2026-09-06) are the versions the SDK list expects, and `.npmrc` `min-release-age=3` refused them on 2026-09-06 as intended. Done (2026-09-12: `expo@57.0.21` and `react-native@0.86.3`; 2026-09-13: `expo@57.0.22` and the rest of the SDK list, with the 3-day cooldown lifted once by operator decision so the templates can rest for a month — `.npmrc` unchanged). The plan was, on or after 2026-09-09, to run `npx expo install --fix`; until then `jest-expo@57.0.5` peers `@react-native/jest-preset@^0.86.3` while `react-native@0.86.0` optionally peers `0.86.0`, so a fresh `npm install <pkg>` reports ERESOLVE — `npm update` and `npm ci` from the lock are unaffected (proved: `npm ci --ignore-scripts` installed 1537 packages cleanly).

**What else moved**: `oxlint` `~1.75.0` → `~1.81.0` (no lockstep partner here). `typescript-eslint@8.69` brought `@typescript-eslint/no-meaningless-void-operator`, which flagged the five `void _param;` statements in the `src/lib/logger.ts` reporter stub; they became no-op comments (a commented body is not an empty function for `no-empty-function`). Stryker 10 on the same tree: 54.32 against 53.92 on 9.6.1, floor 48 unchanged. Held on purpose: Jest 29 (jest-expo), Tailwind 3.4 (NativeWind), TypeScript 6.0 (typescript-eslint peer), Babel 7 (`babel-jest@29`, which `jest-expo@57` depends on, peers `@babel/core ^7.8.0` — so Babel 8 arrives with Jest 30, not before; Dependabot now ignores `@babel/core >=8` for that reason), and every SDK-pinned native package outside the Expo list.

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
- Every action is **SHA-pinned** (since 2026-10-04; the gitleaks action was first). Action
  tags are mutable and have been retargeted in supply-chain attacks; Dependabot's
  `github-actions` ecosystem keeps the pins fresh. The 2026-10 entry at the top of this file
  says why a floating `@vN` tag is not enough.

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
- SHA-pinned Actions (2026-10-04; see the 2026-10 entry at the top of this file)

**Still deferred to product MVP** — adopt when the listed trigger hits:

- HTTP client module — add when the first authenticated API surface lands
- Navigation test mocks — add when routing assertions appear in tests
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

**Revisit trigger (quarterly, starting 2026-08-23; checked 2026-09-12: react #35105 and #35644 both still open, next 2026-12-01)**: check both bugs' `state` via `gh api` — if `closed`, drop awareness section.

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

**Revisit trigger (60-day, 2026-07-23; checked 2026-09-13 via api.npmjs.org last-week downloads: Sentry 2.64M, Datadog RN 503k, Embrace 9k — not crossed, re-armed 2026-12-01)**: if Datadog RN or Embrace mainstream share crosses Sentry's 1.9M DLs, re-evaluate default.

## REJECT list — explicit non-adoption (2026-05-23 /consilium)

**Decision**: explicit DO-NOT-ADOPT register so future agents + forks don't re-litigate. Per /consilium 2026-05-23 APPLY Item 14.

### memlab (Meta heap-snapshot leak detector)

**Status**: skip by default. **Why**: 158K weekly DLs (May 2026), **ZERO published GitHub releases** ([facebook/memlab/releases](https://github.com/facebook/memlab/releases) verbatim "There aren't any releases here"), 0 of 8 React Doctor leaderboard flagship repos use in CI. Adopt only if memory-leak class bug observed.
**Revisit (90-day, 2026-08-23; checked 2026-09-12: still zero GitHub releases, re-armed 2026-12-01)**: memlab v2.0+ formal releases + ≥1 named React app >10K MAU memlab-CI case study.

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

## Content variance on native: props, not pixels — and the limit is stated

**Decision.** Content-bearing components are proven against content they have not seen. The states live in
`src/test/contentStress.ts` — `minimal` / `typical` / `long` / `unbroken` for text, `none` / `one` / `many`
for collections, plus the OS **font scale**. Every assertion is about the PROPS that bound a layout; none
claims anything about pixels.

**Why not a geometry harness like the web siblings.** They render a dev-only fixture route and MEASURE it
in a browser at five widths. There is no browser here: RNTL renders to a tree with no layout engine behind
it, and `.maestro/` needs a device and is deliberately not in the gate. Pretending otherwise would produce
assertions that look like measurements and are not, which is worse than admitting the limit.

**The native axes are not the web ones.** There is no `overflow-wrap` to forget. What actually breaks a
native screen is an unbounded line count in a summary row, a row whose text sibling cannot shrink, and the
accessibility font slider meeting a fixed control height. The first two now have guards
(`numberOfLines` + `ellipsizeMode` on the todo title, a `flex-1` text column asserted by test); the third
is `MAX_FONT_SCALE_IN_FIXED_CONTROL`, bounded rather than disabled — `allowFontScaling={false}` ignores
the user's setting and is never the answer.

**Measured, and it changed the shape of a test:** the button label's rendered props are only `className`
and `children` — `maxFontSizeMultiplier` does not survive NativeWind's JSX interop into what RNTL
exposes. A render assertion there would be permanently red for a correct component, so that one contract
is asserted against the module SOURCE with the reason written next to it. Same pattern as a class-string
contract on the web side: pin the intent where the render cannot show it, and say which it is.

**Both guards were mutation-proven:** removing `numberOfLines` fails four cases, removing
`maxFontSizeMultiplier` fails one; reverting restores sixteen passes.

**Coverage dropout — CLOSED, once the marker was MEASURED on this stack.** It was briefly left open with
the reason "jest prints something different and nobody has measured it here", which was honest and is no
longer true. Measured: an unparseable file inside the coverage scope makes jest print
`Failed to collect coverage from <file>` and **exit 0**, with the summary reporting an unchanged 95.51%
over a set that quietly shrank. `scripts/check-coverage.mjs` wraps the run and refuses on that marker;
proven in both directions. The marker differs from vitest's (`Excluding it from coverage`), which is
exactly why it had to be measured rather than ported.

**`bench:verify` derives its step list** from the `verify` script (following the alias) instead of
restating it, and throws on a segment it cannot parse. Its spec runs under `node:test` like the other gate
specs, not Jest — the sibling templates' vitest version was rewritten rather than copied.

## Complexity ratchet: thresholds above the measured ceiling, production code only

Five ESLint core rules (`complexity` 15, `max-depth` 3, `max-params` 4, `max-lines-per-function` 120,
`max-lines` 200) gate `src/**` excluding tests. Thresholds come from a measurement, not taste: an
ESLint API probe with every rule at warn-zero measured the tree at p95 complexity 5, with ONE
outlier: `shared/ui/Button/Button.tsx:72` at 20 (the shadcn-style variant-resolver arrow — a flat
per-variant class lookup, depth 1). The global limit is 15 (above the next-highest, 13 in
`shared/ui/Input`), and Button carries a documented file-scoped override pinned at its measured 20,
so the exception cannot absorb new growth — one more branch fires the rule. Depth 2 / params 3 /
92 lines per function and 142 per file (both Button.tsx) measured 2026-08-09; the gate is clean on
day one and fires only on future drift. A first-run lesson is recorded here on purpose: the initial
threshold was set from a TRUNCATED probe output (tail cut the complexity section) and the gate
itself caught the error on the first full run — read the whole measurement before deriving a number
from it. **Tests are exempt on purpose**: a `describe` block is one function to these rules and
table-driven suites are long by design; indexing the ratchet on test style is the failure mode that
killed this rule set in a sibling repo's review. When a threshold fires, split the function; raising a
number requires a fresh measurement recorded here.

## Mutation testing: weekly strength gate, deliberately outside `verify`

`npm run test:mutation` (StrykerJS 9.6.1 + jest runner) measures what coverage cannot: whether the
tests would CATCH a wrong implementation. Baseline measured 2026-08-09: **mutation score 53.72%** —
289 of 538 scoreable mutants killed, 218 survived, 31 in code no test covers, 3 runtime errors —
against green 80/60/80/80 coverage floors. That gap is the reason the tool exists here.
`thresholds.break: 48` is a floor-of-record: the weekly `mutation.yml` job (cron + dispatch) fails
only when strength regresses below the measured baseline; raise the floor after a good run, never
lower it to go green. NOT in `verify`/pre-push: a full run costs 2m02s locally and more on CI runners.
**The jest runner works with jest-expo unmodified** — measured, not assumed; `projectType: "custom"`
picks up the package.json jest config. Scope mirrors `collectCoverageFrom` (app shell, env, i18n glue,
constants, locales, `_example*` and barrels stay out for the same reasons they are out of coverage).
RNTL's no-layout limit applies here too: mutants whose effect is purely visual are invisible to this
score and belong to `.maestro/`. The score also measures only the KILL side — would the suite catch a
breakage — and cannot see an over-strict test that wrongly rejects a legitimate implementation; that
side stays with review discipline. Hardenings from an external review of this proposal:
`.stryker-tmp`/`reports` are gitignored AND `ignorePatterns` keeps `.env*` out of Stryker's sandbox
copy (Stryker does not read `.gitignore`); the runner's tree enters the fail-closed audit gate — if it
ever carries a high advisory, the remedy is an override floor with a major cap, not an allowlist entry.

## Override floors + the one honest allowlist: fresh-advisory sweep of 2026-08-09

Fresh high advisories landed on the existing tree at once. Floors (all with major caps): `js-yaml`

> =4.3.1 <5 scoped under cosmiconfig / @eslint/eslintrc / @expo/xcpretty, and >=3.15.1 <4 scoped under
> @istanbuljs/load-nyc-config (two majors need two floors — a top-level pin would force the 3.x consumer
> onto 4.x, which removed `safeLoad`); `nanoid` >=3.3.17 <4 scoped under expo-router; `brace-expansion`
> =5.0.9 <6 and `fast-uri` >=4.1.2 <5 — both were OUR OWN uncapped floors that aged into the vulnerable
> ranges, the exact class the sibling ADRs predicted; `uuid` capped at <15 in the same pass.
> **`image-size` (two DoS advisories, ICNS and JXL/HEIF infinite loops) is allowlisted, not floored,**
> because no fixed release exists: the 1.x line ends at 1.2.1 and the 2.x line at 2.0.2, both inside the
> vulnerable range, and even metro@latest depends on ^1.0.2. The only consumer is metro's build-time
> measurement of repo-local image assets, so no attacker-supplied image reaches the parser here. The
> allowance self-expires 2026-11-01; re-check on the next Expo SDK/metro bump. An allowance is the last
> resort — this is what the last resort looks like: an unfixed upstream, not an inconvenient finding.

## [2026-09] Gate hygiene: the Stryker sandbox is ignored by prettier and ESLint, not only by git

A Stryker run that crashed in a sibling template left `.stryker-tmp/sandbox-*` behind, and the next push
there failed with 44 lint errors that were all inside that copy of the repo (prettier "Delete ⏎" on the
copied files, ESLint "multiple candidate TSConfigRootDirs"). `.stryker-tmp` was in `.gitignore` only, in
all four templates. It is now also in `.prettierignore` and in ESLint's global ignores here: a tool's temp
directory belongs in every ignore list the gate reads, or a crashed tool run reddens the gate for an
unrelated change and reads as a regression.
