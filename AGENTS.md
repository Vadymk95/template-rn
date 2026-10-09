# template-rn — agent guide

Production-ready React Native + Expo starter: file-based routing, strict types, validated env, an enforced quality contract. A scaffold, not a runnable project (install deps, then `npx expo prebuild` for native folders). Stack and versions: `.cursor/brain/PROJECT_CONTEXT.md` § Tech Stack.

## Start here

1. Read `.cursor/brain/PROJECT_CONTEXT.md`, then `READING_INDEX.md` beside it: it maps a situation to the two or three files that answer it. Also there: `MAP.md` (architecture), `SKELETONS.md` (danger zones), `VERIFICATION.md` (what to run per change). Human-facing contract: `docs/strict-template-contract.md`.
2. `.cursor/rules/*.mdc` are **binding for the files they cover**: read the ones for the area you touch before the first edit (`global.mdc` § Rule routing lists which). `agent-pipeline`, `global` and `workflow` are always applied; the rest load by glob.
3. Role commands (`/onboard` `/feat` `/test` `/review` `/docs`) live in `.claude/commands/` with thin shims in `.cursor/commands/`: edit the `.claude/` file, never the shim.
4. Before sweeping the source, confirm the work is still needed (`git log --oneline -15` plus one grep). Name the files when you dispatch work to another agent.

## Source of truth

- **This file is canonical for every tool** (Cursor and Codex load it natively; Claude Code through the import in `CLAUDE.md`). Edit THIS file; never grow the shim.
- **Code is ground truth; this file is a verifiable pointer.** A line that conflicts with the code is stale: follow the code, fix or flag the line in the same session.
- **One canonical place per fact:** versions → `package.json`, commands → the table below, holds → `scripts/version-holds.json`, why → `.cursor/brain/DECISIONS.md`. Everything else points.

## Critical rules

- **Expo Router**: file-based in `src/app/`, route groups via `(folder)`, typed routes on (`experiments.typedRoutes`).
- **CNG**: `app.config.ts` is the source of truth; never hand-edit `ios/` or `android/` (regenerate with `npx expo prebuild --clean`). New Architecture is mandatory since SDK 55: don't re-add `newArchEnabled`. Splash is configured only by the `expo-splash-screen` plugin. `EAS_PROJECT_ID` is optional build-time metadata (it enables `updates.url`).
- **React Compiler** is on (`experiments.reactCompiler`): skip manual `useMemo` / `useCallback` / `React.memo` unless you hit a regression; opt a file out with `"use no memo"`. **Reanimated 4**: `react-native-worklets/plugin` is LAST in `babel.config.js`.
- **NativeWind**: `className` only, no StyleSheet; `hover:` is a no-op on native, use `active:` / `pressed:`. **Colours**: a NativeWind class, or `COLOR_VALUES` from `src/shared/lib/theme/colors.ts` where an API needs a real value; raw hex elsewhere under `src/` fails the gate. **Numbers**: `no-magic-numbers` is on across `src/**` (`-1 0 1 2 100 1000` and enum/index/default positions are free; exempt: `src/shared/lib/theme/**`, tests, root configs).
- **Layers**: `boundaries/dependencies` enforces FSD (`app` → `widgets` → `features` → `entities` → `shared`, downward only); see `.cursor/rules/fsd-layers.mdc`.
- **Components**: arrow-only, explicit props and return types (`const Screen = (): ReactElement => …; export default Screen`), interface callbacks in property style (`onSelect: (id: string) => void`); ESLint enforces both. Logic of heavy UI goes to `useComponentName.ts` beside it.
- **Stores**: Zustand with `createSelectors`; tokens go to `expo-secure-store`, never AsyncStorage.
- **Imports**: `@/` alias only, never `../../`; `tsconfig.json` `paths` is the single definition (no Babel plugin) and its `types: ["jest", "node"]` stays. **Env**: all runtime config through `src/env.ts` (Zod); never read `process.env.*` directly.
- **Logger**: never raw `console.error`; `logger.error(message, error, context)`. **i18n**: user-visible strings go through `t()` with JSON under `src/shared/locales/` (only the init-fallback screen is hardcoded English). **Forms**: `react-hook-form` + `zodResolver` for non-trivial forms; one-off inputs may use `useState`.
- **Testing**: Jest + jest-expo + RNTL 14. `render` / `renderHook` / `fireEvent` / `act` / `unmount` are **async, always `await` them** (an un-awaited `unmount()` poisons the next test). Queries skip accessibility-hidden nodes: pass `{ includeHiddenElements: true }` for intentionally hidden ones. Native E2E: Maestro flows in `.maestro/` (`npm run maestro`).
- **Accessibility**: every interactive primitive in `src/shared/ui` applies `expectAccessibleControl` (`src/test/a11y.ts`) in its own test, and `src/test/uiA11yCoverage.test.ts` fails a new Pressable or TextInput primitive that omits it. The lint plugin peers eslint ≤8, so the check lives in tests (`DECISIONS.md` § Audit backlog).
- **Reuse first**: before creating a function, util, component or constant, search for an existing equivalent and extend it; match the surrounding file's style.
- **Content variance**: UI that renders authored copy is proven against content it has NOT seen (`minimal` / `typical` / `long` / `unbroken` text, `none` / `one` / `many` collections, the OS font scale; states in `src/test/contentStress.ts`). Cap a summary line (`numberOfLines` + `ellipsizeMode`), bound a label in a fixed-height control (`maxFontSizeMultiplier`), never `allowFontScaling={false}`. RNTL has no layout engine: assert the props that bound a layout, leave pixels to `.maestro/` or a device. Detail: `VERIFICATION.md` § Content variance.

## Commands / the gate

The tier law (what runs at which moment, what is never run by hand) is the shared block below; this table is the repo's command list. Every other script: `package.json` and the README tables.

```bash
npm start            # Expo dev server (QR → Expo Go / Dev Client)
npm run verify:iter  # iteration tier: oxlint → tsc (incremental) → jest --onlyChanged (seconds; not a hand-over gate)
npm run verify       # every OFFLINE check: hooks → version holds → oxlint → format → typecheck → eslint (cached) → scripts → coverage
npm run verify:ci    # audit:gate (network) + verify — what husky pre-push AND CI both run
npm run fix          # the one remedy: oxlint --fix → eslint --fix → prettier --write
npm run ci:local     # verify:ci + expo-doctor (full local parity)
npm run test:one -- <file> # one jest test file, through the tracer (not around it)
npm run trace:report # findings from .gate-trace.log (forbidden moments, budgets, worktrees)
npm run docs:check   # docs drift (paths, scripts, versions, command table, dead docs); weekly CI adds --weekly
npm run bench:verify # per-step timings when the gate feels slow
npm run test:mutation # StrykerJS strength gate — weekly `mutation.yml`, NOT in verify
```

<!-- shared-harness:begin -->
<!-- This block is byte-identical in all four templates (template-1, template-spa-pwa, template-next-seo, template-rn). Change it in every template in the same commit, or not at all. Stack-specific facts (which stages `verify` runs, ports, what is skipped and why, timings) live OUTSIDE this block: in the command table above and in `.cursor/brain/VERIFICATION.md`. -->

### The tier law - this section is the ONLY place it lives

Every other file (rules, commands, brain, README, Copilot instructions) points here and restates nothing.
A restated pipeline rule goes stale in place; a stale copy cost a sibling repo a day of 40-minute rounds
because five copies still demanded the full chain before the first report. `scripts/gate-tiers.json` is
the machine-readable form (expected and forbidden scripts per moment, budgets, phase); when this prose and
that file disagree, the file wins and the prose is fixed in the same commit.

**Four moments, and one that is not a gate.**

- **Iterate** - per change, seconds. Run `verify:iter`. Where the change touches a surface that has its
  own spec and the repo has a browser lane, run that ONE spec through the traced single-spec script (see
  the command table). Nothing heavier.
- **Measure** - whenever only a rendered result can answer the question: the measure script (build +
  look) or the probe, where the repo has them. Legal at any time, in any lane, never a violation.
  Measuring is not verifying: it runs no lint, no types, no tests.
- **Commit** - the pre-commit hook owns it: staged autofix, the TDD sibling gate, then the repo-wide cheap
  checks. Nothing to run by hand; on refusal the hook prints the remedy.
- **Push** - the pre-push hook runs the gate ONCE, never shortened by what the diff touched. Where the
  repo has heavy stages (build, size, e2e), the push script is phase-aware: phase 0 (scaffold, before the
  first deploy) runs the offline checks and loudly SKIPS the heavy stages; phase 1 (from the first deploy)
  runs the full `verify:ci`. A skipped stage is printed, never silent; flip the phase in one commit at the
  first deploy. A repo whose gate has no heavy stage runs the full `verify:ci` at push and records in
  `gate-tiers.json` that a phase switch would gate nothing.
- **CI** - phase-blind: always the full `verify:ci` (`audit:gate` + `verify`), plus what only CI can do
  (the security workflow, the scheduled mutation job, a mandatory dev-smoke job where the repo has one).

**Prohibitions, stated as such.** An implementer or a reviewer NEVER runs `verify`, `verify:ci`,
the fuller `verify:*` variants, `build` or the e2e suite by hand: the full chain belongs to the push hook and CI, and a
result an agent cannot act on is not worth its minutes. A review round gets the diff plus `verify:iter`;
acceptance does not re-run the gate, the push does. Parallel lanes never run heavy stages (one machine,
shared caches): heavy work serialises at the push. Individual scripts (`typecheck`, `lint`, `test`, `fix`)
are drill-downs on a specific failure; none of them is a moment.

**A red push costs one fix, not another round of the whole gate.** Where the repo has a browser suite, it
stops after a capped number of failures on the gate run and in CI (`maxFailures`) instead of running every
remaining test into its timeouts. After a red push, whoever pushes fixes the cause, rebuilds only when the
failing stage runs against a build, re-runs only the tests that failed until they pass, then pushes again;
the push still runs the whole gate and reaches whatever the cap stopped short of. Name the failed spec files
from the red output: Playwright's `--last-failed` also re-runs every test a capped run never reached, which
is most of the suite, so it fits only a red that finished under the cap (Jest's `--onlyFailures` has no such
catch). That re-run is a drill-down on a known failure, so it is the one sanctioned hand-run of a build or of
browser tests, and it never replaces the push. Each browser config writes to its own output folder, so the
last-failed record always belongs to the suite that failed.

**What earns a browser test.** The browser suite is counted in INVARIANTS, not in screens. A new route
or a new component earns a browser test only when it brings an invariant the existing specs do not
already measure: a different layout shell, an engine-dependent behaviour, the first instance of a flow
class. Everything else is a unit test against a mocked network, which runs in the iterate moment and
costs the push nothing. `gate-tiers.json` declares the suite's ceiling and `docs:check` reports a suite
that outgrew it, so that number moves on a measurement and a `DECISIONS.md` line, never on habit.

**`verify` is a strict superset of the offline checks CI runs**, so a green `verify` predicts a green CI.
Keeping that true is a rule: a new check goes into the script, never only into the workflow file.
`audit:gate` sits in `verify:ci` rather than `verify` because it needs the network, so an offline agent can
still run the whole offline gate. `bench:verify` derives its step list from the `verify` script; a
hand-written second list has already drifted once.

**Every gate run is traced** to `.gate-trace.log`; `trace:report` turns the log into findings (forbidden
moments, blown budgets, gate runs from a worktree). After a push, gate output in the terminal is part of
the contract: **silence is a failure, not a pass** - a push that printed no gate ran no gate, whatever the
exit code says.

**Ports.** A busy port means MOVE, never kill a server you did not start; the single-spec and measure
scripts take the next free port. Only the push gate clears its own port.

### Lanes - who runs what

- **Main agent, inline.** Iterate and measure while working; the push runs the chain. Never the full gate
  by hand.
- **Implementer subagent.** Works in a hand-made `git worktree` OUTSIDE the repo directory, on its own
  port, with `node_modules` symlinked from the main checkout. Iterate and measure only; the gate never
  runs from a worktree (the tracer records it as a finding). The lead removes the worktree, checks the
  branch out in the main checkout and pushes from there, so the gate runs once, at the push, for every
  writer.
- **Copilot coding agent.** Hand-over is a fully specified issue (goal as behaviour, paths in scope,
  acceptance, out of scope; use `.github/ISSUE_TEMPLATE/agent-task.yml` where the repo ships it), assigned
  to Copilot. It works on its own branch and opens a draft pull request; workflows on that PR start only
  after a human approves the run. Task class: verifiable by the gate, under ~400 changed lines, contract
  stated in the issue, nothing on the mandatory-human-review list. Its review context is
  `.github/copilot-instructions.md`, which points here for the gate.
- **Review, any lane.** The diff plus `verify:iter`, never a re-run of the gate. Findings are correctness,
  test strength, security, readability; style belongs to the linters. A non-author human approves; an
  agent's own green is not an approval.
- **Two tools, one file.** Claude Code reads `CLAUDE.md` -> `AGENTS.md` -> the brain files this guide
  points at (read on demand; nothing beyond `AGENTS.md` is `@`-imported); Cursor reads `AGENTS.md` plus
  every `alwaysApply: true` rule; Copilot reads `.github/copilot-instructions.md`. `AGENTS.md` is the only
  file all of them read, which is why the law lives here and everything else is a pointer.
- **What an agent may not do.** `.claude/settings.json` holds the agent-side limits; they bind Claude Code
  only (Cursor, Copilot and Codex do not read that file). Denied in every permission mode, bypass
  included: reading .env files other than the example, editing `.claude/settings.json` itself, a force
  push (a `+branch` refspec too), `--no-verify` or `-n` on a commit, `--no-verify` on a push,
  `git reset --hard`, `git clean -f`. Asked before every edit of the gate files, the documented edits
  included (the phase flip, a raised mutation threshold): `.husky/`, `.github/workflows/`,
  `.github/ruleset.json`, `scripts/gate-tiers.json`, `stryker.config.json`, `.npmrc`. A rule matches the
  command or path as an agent usually writes it and is not a security boundary: `sh -c`, a full binary
  path, a `git -C` or `git -c` prefix, a bundled flag such as `-uf`, or a command that reads a file
  without naming it (`grep -r`) walks past it. The boundary is the required CI check on the default
  branch. To change a guarded file, edit it yourself or change the rule in a reviewed commit.

### Before code - spec and plan

A task bigger than a one-sentence diff gets two tracked files under `.cursor/<feature-slug>/` before the
first edit: `SPEC.md` (WHAT and WHY: evidence per claim with its source kind, acceptance criteria as
Given / When / Then, open questions with `blocking` and `evidence tried` - an unknown is parked there,
never invented) and `PLAN.md` (HOW: changes per file with the code that was read, what is reused,
sequencing in 2-7 slices each under ~400 changed lines, a test per acceptance criterion, risks, danger
zones). Copy both from `.cursor/templates/`. Approval is a non-author review of the pull request that
adds or changes them, never a phrase in a chat recorded by an agent. `/feat` starts from the plan; a plan
that lives only in a conversation is not a plan.

<!-- shared-harness:end -->

## Working agreements

- **No browser lane**: a question only a rendered result can answer goes to `.maestro/` or a device (the substitute ladder closes `READING_INDEX.md`). The push runs the full `verify:ci` directly (`gate-tiers.json` `_phaseMeaning` says why); the by-hand prohibition also covers `ci:local` and `test:mutation`. Change the tracer's discipline by editing `scripts/gate-tiers.json`, never the analyser. The gate binds no port: if Metro's is busy, MOVE (`npx expo start --port <free>`), kill nothing.
- **Bootstrap after clone**: `npm run prepare` once (`.npmrc` disables lifecycle scripts as a supply-chain guard, so husky does not self-install; `verify` fails loudly without hooks). Dependency cooldown `.npmrc` `min-release-age=3` (days): a brand-new package or urgent patch needs `npm install <pkg> --min-release-age=0`.
- **Zero warnings** (`eslint --max-warnings 0`, `oxlint --deny-warnings`): fix the cause; never downgrade a rule or sprinkle `eslint-disable`. A directive that must stay names its rules and carries `-- reason`; `oxlint-disable*` is banned. A rule wrong for a class of files gets a documented file-scoped override (`eslint.config.mjs`, or `overrides` in `.oxlintrc.json`).
- **Complexity ratchet**: `complexity` 15 / `max-depth` 3 / `max-params` 4 / `max-lines-per-function` 120 / `max-lines` 200 over `src/**`, tests exempt. The numbers sit above the measured ceiling (`DECISIONS.md`), so a hit means new drift: split the function first; raising one needs a fresh measurement and a `DECISIONS.md` line.
- **Mutation testing** (`npm run test:mutation`): coverage proves code RUNS, the score proves tests would CATCH a wrong implementation. `thresholds.break` in `stryker.config.json` is a measured floor: raise it after a good run, never lower it to go green.
- **Machine-agnostic configs**: no absolute local paths (keep `i18next.i18nPaths` relative; the VS Code extension rewrites it) and no DURATION measured on one machine (`gate-tiers.json` holds a ratio; the baseline lives in the gitignored `.gate-budget.json`).
- **Ask before** weakening the gate, a lint severity or a coverage threshold to get green, hand-editing `ios/` / `android/`, or bumping the Node engine (`engines.node`).

## Version holds (do not "fix" by bumping)

`scripts/version-holds.json` is the list (range, reason, lift condition, evidence). `scripts/check-version-holds.mjs`, inside `verify`, fails a manifest or lockfile outside a range and a missing Dependabot `ignore`. A hold lifts on its stated condition, never because `npm outdated` lists something newer. Why: `DECISIONS.md`.

- **Native/Expo packages are SDK-pinned** (`react`, `react-native`, `react-native-*`, `expo-*`, async-storage): versions come from `npx expo install --fix`, never from `npm outdated`. Lift: the SDK upgrade.
- **`expo install --check` / `expo-doctor` can go red for a patch the cooldown holds**: wait out `min-release-age`, or take it once with `npm_config_min_release_age=0 npx expo install --fix` and record each version, publish date and provenance in `DECISIONS.md`. Never lower `min-release-age` in `.npmrc`; `EXPO_OFFLINE=1 npx expo install --check` stays green meanwhile.
- **`test-renderer` stays `~1.2.x`** (its 1.3 reconciler peers a newer React than the SDK pins). **Jest and `@types/jest` stay 29.x, `@babel/core` stays 7.x** (`jest-expo` is built on jest 29 internals). **Tailwind stays 3.4.x** (NativeWind 4 calls Tailwind 3 internals). **TypeScript stays `~6.0.x`** (typescript-eslint peer range). **`@types/react` stays level with the pinned `react`**.
- **ESLint is 10.x**: the trailing block in `eslint.config.mjs` pins `settings.react.version` to a literal because `eslint-config-expo`'s `'detect'` crashes every React rule. Do not delete it or set it back to `'detect'`.
- **`overrides` in `package.json` are security floors WITH major caps** (`">=fixed <next-major"`): an uncapped floor ages into its advisory's vulnerable range. Never write one without a cap, never remove a floor to quiet npm; a stale audit allowance fails the gate by design.
- **`oxlint` has no lockstep partner** (`eslint-plugin-oxlint` is not installed): bump it alone.

## Changes reach master through a pull request

Branch, run the gate, push the branch, open a PR, merge when CI is green. Here `master` has a ruleset requiring the checks named in `.github/ruleset.json`, and the owner role can bypass it with a direct push: don't. **A fork inherits files, not settings:** it arrives with the whole gate and none of the enforcement until you switch it on (`README.md` § "What your fork does not inherit").

## Commit format

`type(scope): description`, English, imperative, max 96 chars, no `Co-authored-by` trailer (no hook checks the trailer). Types: `feat` `fix` `chore` `docs` `style` `refactor` `perf` `test` `revert` `build` `ci`.

## Maintaining this file

Keep it under 200 lines. Add a rule when an agent or developer makes the same mistake twice: one line tied to the observed failure. Prune stale lines; depth lives in `.cursor/brain/`.
