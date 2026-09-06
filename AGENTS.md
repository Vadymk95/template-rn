# template-rn — agent guide

Production-ready React Native + Expo starter — Expo SDK 57, file-based routing, strict types, validated env, enforced quality contract. A scaffold, not a runnable project (install deps, then `npx expo prebuild` for native folders).

## Start here

1. Read `.cursor/brain/PROJECT_CONTEXT.md` before any task. Architecture map: `.cursor/brain/MAP.md`. What to run per change: `.cursor/brain/VERIFICATION.md`. Human-facing strict contract: `docs/strict-template-contract.md`.
2. `.cursor/rules/*.mdc` are **binding for the files they cover** — read the rules relevant to the area you touch before the first edit. `agent-pipeline`, `global`, `project-config` and `workflow` are always applied; the rest load by glob.
3. Role commands live in `.claude/commands/` (canonical) with thin pointers in `.cursor/commands/` so both tools behave identically: `/onboard`, `/feat`, `/test`, `/review`, `/docs`. Edit the `.claude/` file, never the shim.

## Source of truth (tiebreaker)

- **This file is the canonical guide for every tool.** Cursor and Codex load it natively; Claude Code loads it through the one-line `@AGENTS.md` import in `CLAUDE.md`. Edit THIS file; never grow the shim.
- **Code is ground truth; this file is a verifiable pointer.** If a line here conflicts with the code, follow the CODE and fix or flag the stale line in the same session.

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6.0 strict · Expo Router v57 · NativeWind 4.2 (Tailwind 3.4) · Zustand 5 · TanStack Query 5 · Jest 29 + jest-expo + @testing-library/react-native 14 · React Compiler

## Critical rules

**Expo Router** — file-based in `src/app/`. Route groups via `(folder)`. Typed routes enabled (`experiments.typedRoutes: true`).

**New Architecture is mandatory** since SDK 55 — don't re-add `newArchEnabled: true` to `app.config.ts`, it's a no-op.

**React Compiler** is enabled (`experiments.reactCompiler: true`). Skip manual `useMemo`/`useCallback`/`React.memo` unless you hit a specific regression. Opt a file out with `"use no memo"` at the top.

**Reanimated 4 worklets plugin** — `react-native-worklets/plugin` in `babel.config.js`, must be LAST.

**NativeWind** — `className` only, no StyleSheet. `hover:` classes are no-ops on native, use `active:` / `pressed:`.

**Colours** — a NativeWind class, or `COLOR_VALUES` from `src/shared/lib/theme/colors.ts` where an API needs a real value (navigation options, native props). Raw hex anywhere else under `src/` fails the gate.

**Numbers** — `@typescript-eslint/no-magic-numbers` is on across `src/**`. `-1 0 1 2 100 1000` and enum/index/default positions are free; anything else gets a name. Exempt: `src/shared/lib/theme/**`, tests, root config files.

**Layer imports** — `boundaries/dependencies` enforces the FSD map (`app` → `widgets` → `features` → `entities` → `shared`, downward only). It is lint law, not a convention: see `.cursor/rules/fsd-layers.mdc`.

**Components** — arrow-only; explicit props type + explicit output: `const Screen = (): ReactElement => …; export default Screen` (or `FunctionComponent<Props>` annotation) — enforced by `@typescript-eslint/explicit-function-return-type` (inline callbacks exempt). Interface callbacks use property style (`onSelect: (id: string) => void`) — enforced by `method-signature-style`. Extract logic to `useComponentName.ts` next to heavy UI.

**Stores** — Zustand with `createSelectors`. Tokens go to `expo-secure-store`, not AsyncStorage.

**Imports** — `@/` alias only, no relative `../../`. Single source of truth is `tsconfig.json` `paths` (Metro reads it directly — no Babel plugin). `tsconfig.json` pins `types: ["jest", "node"]` — jest globals in tests resolve through it; don't remove.

**Env** — all runtime config via `src/env.ts` (Zod-validated). Never read `process.env.*` directly.

**Splash** — configured ONLY via the `expo-splash-screen` plugin in `app.config.ts`; the legacy top-level `splash` key was removed from the config schema in SDK 57.

**EAS / OTA** — `EAS_PROJECT_ID` is optional build-time metadata for `app.config.ts` (enables `updates.url` when set). Local Expo Go / forks without EAS omit it.

**CNG** — `app.config.ts` is the source of truth. Do NOT hand-edit `ios/` or `android/` — regenerate via `npx expo prebuild --clean` (SDK 57: prebuild clears native dirs by default).

**Logger** — never raw `console.error`. Always `logger.error(message, error, context)`.

**i18n** — user-visible strings go through `useTranslation` / `t()` and JSON under `src/shared/locales/`. Only the init-fallback screen uses hardcoded English (no `t()`).

**Forms** — `react-hook-form` + `zodResolver` for non-trivial forms; one-off inputs may use `useState`.

**Testing** — Jest + jest-expo + RNTL 14: `render`/`renderHook`/`fireEvent`/`act`/`unmount` are **async — always `await` them** (an un-awaited `unmount()` poisons the next test's render). Queries skip accessibility-hidden elements by default — pass `{ includeHiddenElements: true }` to reach intentionally hidden nodes (e.g. dialog backdrop). Native E2E: Maestro flows under `.maestro/` (`npm run maestro`).

**Reuse first** — before creating any function/util/component/constant, search for an existing equivalent and extend it. Duplicate utilities are a violation, not a style choice.

**Consistency beats preference** — match the surrounding file's style and patterns.

**Content variance** — anything that renders authored copy is proven against content it has NOT seen:
`minimal` / `typical` / `long` / `unbroken` for text, `none` / `one` / `many` for collections, and the OS
font scale. States live in `src/test/contentStress.ts`. The native axes are not the web ones: there is no
`overflow-wrap` to forget, and what breaks a screen is an unbounded line count in a summary row, a row
whose text sibling cannot shrink, and the accessibility font slider against a fixed control height. Cap a
summary line count (`numberOfLines` + `ellipsizeMode`) and bound a label in a fixed-height control
(`maxFontSizeMultiplier`) — never `allowFontScaling={false}`, which ignores the user's setting.

**RNTL cannot measure layout, and that limit is stated rather than worked around** — it renders to a tree
with no layout engine, so a test asserts the PROPS that bound a layout and nothing about pixels. Some
props do not survive NativeWind's JSX interop into what RNTL exposes (measured on the button label, whose
rendered props are only `className` and `children`); there the assertion goes against the module source
with the reason next to it. Pixels need a device — `.maestro/`.

## Entering this repo cheaply (read this before sweeping the source)

Measured on a sibling project 2026-08-30: an agent's entry is ~93% READING SOURCE to find where
things are and whether the task is still needed, and ~7% the documents that load automatically. So
the levers are pointing and looking, in this order:

1. **Open `.cursor/brain/READING_INDEX.md` first** — it maps a SITUATION ("about to change a shared
   primitive") to the two or three files that answer it. It is a pointer file: it never restates a
   rule, so it cannot go stale in the way a summary does.
2. **Check the work is still needed** — `git log --oneline -15` plus one grep for the thing the task
   names. Two of five lanes in that measurement returned "already done" after ~430k tokens; both
   were five minutes of grep.
3. **Do not invent a way to LOOK** - RNTL has no layout engine, so nothing here can measure a pixel. Assert the props that bound a layout, then `.maestro/`, then a device. `.cursor/brain/READING_INDEX.md` closes with the full substitute ladder.
4. **Name the files when you dispatch work to another agent.** The largest observed difference
   between a 33-tool-call lane and a 191-tool-call lane was how precisely the task pointed.

**Where a rule must live** (which tool reads which file, and why a rule that must reach every tool
belongs in this file): § Commands / the gate › Lanes › _Two tools, one file_. Verify what each tool
loads before moving a rule between files.

## Commands / the gate

```bash
npm start            # Expo dev server (QR → Expo Go / Dev Client)
npm run verify:iter  # iteration tier: oxlint → tsc (incremental) → jest --onlyChanged (seconds; not a hand-over gate)
npm run verify       # every OFFLINE check: hooks → oxlint → format → typecheck → eslint (cached) → scripts → coverage
npm run verify:ci    # audit:gate (network) + verify — what husky pre-push AND CI both run
npm run fix          # the one remedy: oxlint --fix → eslint --fix → prettier --write
npm run ci:local     # verify:ci + expo-doctor (full local parity)
npm run test:one -- <file> # one jest test file, through the tracer (not around it)
npm run trace:report # findings from .gate-trace.log (forbidden moments, budgets, worktrees)
npm run bench:verify # per-step timings when the gate feels slow
npm run test:mutation # StrykerJS strength gate — weekly `mutation.yml` job, NOT in verify (2m per run)
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
`verify:full`, `build` or the e2e suite by hand: the full chain belongs to the push hook and CI, and a
result an agent cannot act on is not worth its minutes. A review round gets the diff plus `verify:iter`;
acceptance does not re-run the gate, the push does. Parallel lanes never run heavy stages (one machine,
shared caches): heavy work serialises at the push. Individual scripts (`typecheck`, `lint`, `test`, `fix`)
are drill-downs on a specific failure; none of them is a moment.

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
- **Two tools, one file.** Claude Code reads `CLAUDE.md` -> `AGENTS.md` -> the `@`-imported brain; Cursor
  reads `AGENTS.md` plus every `alwaysApply: true` rule; Copilot reads `.github/copilot-instructions.md`.
  `AGENTS.md` is the only file all of them read, which is why the law lives here and everything else is a
  pointer.

<!-- shared-harness:end -->

**This repo's specifics, outside the shared block.** There is no browser lane: no measure script, no
probe, no single-spec e2e — RNTL has no layout engine, so a question only a rendered result can answer
goes to `.maestro/` or a device (the substitute ladder closes `.cursor/brain/READING_INDEX.md`). The
push runs the full `verify:ci` directly; `scripts/gate-tiers.json` (`_phaseMeaning`) records why a
scaffold phase would gate nothing here. The by-hand prohibition also covers `ci:local` and
`test:mutation`. Native pixels are Maestro's job, never the gate's. The tracer additionally flags a
code check on a docs-only change; the discipline changes by editing `scripts/gate-tiers.json`, never
the analyser. Ports: the gate binds none, so nothing here kills anything — if a Metro port is busy,
MOVE (`npx expo start --port <free>`).

**Bootstrap after clone**: `npm run prepare` (once) — `.npmrc` disables lifecycle
scripts as a supply-chain guard, so husky hooks don't install themselves; the
verify gate fails loudly if hooks are missing. Dependency cooldown is also on
(`.npmrc` `min-release-age=3`, DAYS): a brand-new package or urgent patch needs
`npm install <pkg> --min-release-age=0`.

The gate is **zero-warnings**: `eslint --max-warnings 0`, `oxlint --deny-warnings`. If it fails, fix the cause — do **not** downgrade rules, silence warnings, or sprinkle `eslint-disable`. If a rule is genuinely wrong for a class of files, add a documented file-scoped override in `eslint.config.mjs` stating why.

**Complexity ratchet** — `complexity` 15 / `max-depth` 3 / `max-params` 4 / `max-lines-per-function` 120 / `max-lines` 200 over `src/**`, tests exempt. Thresholds sit above the measured ceiling (see `DECISIONS.md`), so a hit means new drift: split the function first; raising a number needs a fresh measurement and a `DECISIONS.md` line.

**Mutation testing** — `npm run test:mutation` (StrykerJS + jest runner, weekly `mutation.yml` CI job). Coverage proves code RUNS under tests; the mutation score proves tests would CATCH a wrong implementation — the two disagree here by design (80% coverage floor vs 53.7% baseline score). `thresholds.break` in `stryker.config.json` is a measured floor-of-record: raise it after a good run, never lower it to go green. RNTL's no-layout limit applies to mutants too: a defect only pixels would show belongs to `.maestro/`, not this score.

## Version holds (do not "fix" by bumping)

- **Native/Expo packages are SDK-pinned** — `react`, `react-native`, `react-native-*`, `expo-*` versions come from `npx expo install --fix`, NOT from `npm outdated`. Bumping past the SDK list breaks Expo Go / jest-expo.
- **Jest stays 29.x** — `jest-expo@57` is built on jest 29 internals (`babel-jest ^29.2.1`); `@types/jest` stays 29.x with it.
- **Tailwind stays 3.4.x** — NativeWind 4.x is built against the Tailwind 3 config format.
- **TypeScript stays `~6.0.x`** — `typescript-eslint@8` peers `typescript >=4.8.4 <6.1.0`.
- **ESLint is 10.x.** `eslint-config-expo` sets `settings.react.version: 'detect'`, which crashes every React rule under ESLint 10, so `eslint.config.mjs` ends with a trailing block pinning the version to a literal. Do not delete it and do not set it back to `'detect'` — see the ESLint 10 entry in `.cursor/brain/DECISIONS.md`.
- **`oxlint` has no lockstep partner here** — `eslint-plugin-oxlint` is deliberately not installed, so oxlint is bumped on its own (unlike the sibling web templates).
- **`@expo/vector-icons` is deprecated upstream** (SDK 56+) but pinned explicitly and functional; migration path is `npx @react-native-vector-icons/codemod` — a deliberate follow-up, not a drive-by.
- **`overrides` in `package.json` are security floors WITH major caps** (`">=fixed <next-major"`). Two of our own uncapped floors (brace-expansion, fast-uri) aged into their advisories' vulnerable ranges and turned the audit gate red — an uncapped floor is a delayed regression. Do not remove a floor to quiet npm, and never write one without a cap; details in `DECISIONS.md`. The `image-size` advisories are ALLOWLISTED, not floored: no fixed release exists in either major (see `scripts/audit-allowlist.json`).

## Machine-agnostic configs

Committed configs must never contain absolute local paths. The VS Code i18next extension rewrites `i18next.i18nPaths` with absolute paths when it can't resolve the configured ones — keep them relative and existing.

## Out of scope (ask before touching)

- Weakening the verify gate, lint severities, or coverage thresholds to get green.
- Hand-editing `ios/` / `android/` (CNG owns them).
- Node engine bump (`engines.node`).

## Commit format

`type(scope): description` — max 96 chars.
Types: `feat` `fix` `chore` `docs` `style` `refactor` `perf` `test` `revert` `build` `ci`

## Maintaining this file

Treat it like code. Add a rule when an agent or developer makes the same mistake twice — one line tied to the observed failure. Prune stale lines; a bloated file reduces compliance. One-line digests only — depth lives in `.cursor/brain/`.
