# VERIFICATION — Which checks to run per change

Match the check to the MOMENT. **The tier law itself lives in `AGENTS.md` § Commands / the gate —
one place, everything else points at it.** This file holds the mechanics: the per-change table, the
hooks, the tracer and what the absence of a scaffold phase is based on.

## The moments

- **Iterate** — `npm run verify:iter`, per change, seconds.
- **Docs, rules, commands, brain, tier data** (`*.md`, `*.mdc`, `scripts/gate-tiers.json`) — `npm run docs:check` (the pre-commit hook runs it when such files are staged; `--weekly`, the scheduled Docs workflow's flag, runs the same checks so a quarantine that expires while nobody pushes still turns it red; it also refuses a focused test, an unconditional skip without `quarantine until YYYY-MM-DD` + reason, and an agent-memory import: an `@` pointer in `CLAUDE.md` or `AGENTS.md` that names a file, which Claude Code would load into every session; write it as a backticked path instead)
- **Proposing a new Maestro flow** — the suite is counted in invariants, not screens (`AGENTS.md` § the gate); `npm run docs:check` reports the suite against the ceiling in `scripts/gate-tiers.json` § suites
- **Commit** — the pre-commit hook (below). Nothing by hand.
- **Push** — the pre-push hook runs `verify:ci`. Never run it, `verify`, or `ci:local` by hand;
  `ci:local` additionally needs local native tooling and takes minutes.

**No scaffold phase here, and that is a measurement — the numbers and the decision live in
`scripts/gate-tiers.json` (`_phaseMeaning`), and this is the pointer.** In short: nothing in this
gate is heavy enough to defer, so a phase switch would be machinery gating nothing. Revisit if a
native build or a Maestro run ever enters the gate.

Measured here (`.gate-trace.log`, 2026-08-30 to 2026-09-11): the push — `verify:ci`, traced under that
label because the hook runs it directly — 11.7-23.0 s; the first two pushes after the 2026-09-06
dependency reinstall took 46.3 / 34.3 s and are the only rows over the 30 s
`push` budget in `gate-tiers.json`, which is unchanged; `verify` alone 8.4-20.2 s; `verify:iter`
2.5-4.1 s; one `test:one` file 8.3 s; the mutation run 2m02s (`mutation.yml`, outside the gate).

## The tracer — how it works (the RULES it enforces are the tier law)

Every `verify*` and `test:one` run appends one TSV row to `.gate-trace.log` (gitignored);
`npm run trace:report` turns rows into findings — a forbidden stage run standalone, a run over its
moment's budget, a code check against a docs-only change, a push from a linked worktree. Moments,
budgets and classes are DATA in `scripts/gate-tiers.json`; the analyser names no stage, so the
discipline changes by editing that JSON. Telemetry sees WHO ran WHAT and HOW LONG — whether a check
CAN fail is mutation-proving's job.

## By change type

| Changed                                 | Run                                                         |
| --------------------------------------- | ----------------------------------------------------------- |
| TS/TSX business code                    | `npm run verify:iter` (oxlint → tsc → `jest --onlyChanged`) |
| Style-only (className tweaks)           | `npm run lint`                                              |
| i18n copy (`src/shared/locales/*.json`) | `npm run format:check`                                      |
| `src/env.ts` or `.env`                  | `npm run typecheck` + restart dev server                    |
| `app.config.ts`                         | `npx expo-doctor && npx expo prebuild --clean` (if native)  |
| Native config plugin                    | `npx expo prebuild --clean && npm run ios` / `android`      |
| `package.json` dependency               | `npx expo install --fix && npx expo-doctor`                 |
| `babel.config.js` / `metro.config.js`   | Restart dev server with `--clear`                           |
| Test file only                          | `npm run test:one -- <path>` (through the tracer)           |

## What the git hooks enforce

- **pre-commit** — `lint-staged` (oxlint --fix → eslint --fix → prettier) on the staged
  files, then the TDD sibling gate (`scripts/check-test-siblings.mjs`, staged-only), then
  a **repo-wide** `lint:oxlint`, `format:check` and `typecheck`, all three run before the
  hook decides so one attempt reports everything. Why the repo-wide pass exists:
  `DECISIONS.md` § TDD sibling gate on pre-commit. Remedy: `npm run fix && git add -u`.
- **commit-msg** — commitlint (Conventional Commits, subject ≤96 chars).
- **pre-push** — `npm run verify:ci`, the same script CI runs.

Not adopted: a hook that commits for you. A hook that creates commits hides what it
changed inside a commit you did not write, and the failure mode is a fix landing under an
unrelated message. The hook reports and refuses; the remedy is one command.

## What each chain contains (mechanics — WHEN to run them is the tier law)

Three rungs, and the split is deliberate:

- **`npm run verify:iter`** — the iteration rung: `lint:oxlint` → `typecheck` (incremental) →
  `jest --onlyChanged --passWithNoTests` (only tests git sees as affected by uncommitted work).
  `--onlyChanged` follows the module graph from changed files, so cross-cutting suites and
  `scripts/**` tests (`test:scripts`) surface at the push chain, not during iteration.
- **`npm run verify`** — every check that works OFFLINE. Stage order: the `verify:inner` script in
  `package.json` (cheap independent stages first); the superset rule and the push/CI split:
  `AGENTS.md` § Commands / the gate; why: `DECISIONS.md` § The gate contract. **No gate preflight
  here, deliberately:** this gate has no production build, no e2e port and no required env, so every
  candidate check would be one that cannot fail — and a check that cannot fail only claims coverage.
- **`npm run verify:ci`** — `audit:gate` + `lock:age` (both need the registry) + `verify`. This is
  what husky pre-push runs and what the CI job runs, as a single step.

`npm run test:mutation` sits on neither rung on purpose: it runs weekly via the
`mutation.yml` cron, never as part of `verify` — see AGENTS.md § Working agreements. `npm run perf:check`
(the Hermes bundle budget) is the same kind of lane: the `bundle-budget` job in `ci.yml` runs it on every
pull request and push, and `scripts/gate-tiers.json` § ci.allowedRunSteps records why it is outside `verify`.

The checklist (exit code without a pipe, prove the gate can go red, name the condition under which a
green would have been red): § Verification integrity below — one home.

When it fails: `npm run fix && git add -u` for lint/format findings. Never lower a
severity, move a coverage threshold, or extend an ignore list to reach green.

**After a red push**: fix the cause, then re-run only the failures with `npx jest --onlyFailures`
(the repo's test command is bare `jest`, so the flag needs no extra wiring) until green, then push
again — see `AGENTS.md` § the gate.

## Native / machine parity

Run `npm run ci:local` when:

- touching native config, Expo / build tooling, Metro / Babel, or dependencies
- preparing a release branch
- validating a machine against Expo tooling

`ci:local` = `verify:ci` + `doctor`. `expo-doctor` is intentionally kept out of the
core repo contract because it depends on local native tooling and on live SDK
state; CI runs it `continue-on-error` for the same reason. `verify:native`
(= `verify` + `doctor`) is the offline variant.

## Before first EAS build

Run `npx expo-doctor` (must exit 0), then `npx expo prebuild --clean` to prove
native generation, then `eas build:configure` if `eas.json` needs
project-specific tweaks.

## Before submitting to App Store

Production iOS build via EAS (`eas build` with the production profile), manual
device smoke (cold start, tabs, push opt-in if applicable, crash reporting once
wired), then `eas submit` for the store pipeline.

## Physical device (Expo Go)

- **Web URL in terminal (`http://localhost:8081`)** — Metro may compile a **web** bundle; `react-native-web` + `react-dom` are installed so that path does not crash. The template still targets **native** only (`PROJECT_CONTEXT` non-goals); use browser preview only for quick checks, not as a product surface.
- **LAN:** `npm start` — phone and Mac on the same Wi‑Fi; scan QR or open `exp://…` from the terminal in Expo Go.
- **Tunnel (no same-LAN needed):** `npm run start:tunnel` — uses `@expo/ngrok` (devDependency). If you see `failed to start tunnel` / `remote gone away`, check [ngrok status](https://status.ngrok.com/), try without VPN, or retry later; then fall back to LAN or `npm run ios` (Simulator).
- Non-interactive automation: set `CI=1` (Expo reads it instead of TTY prompts).

## OTA discipline

OTA (EAS Update) — safe for: JS logic, i18n strings, NativeWind styles, feature flags, minor UI changes.

Native rebuild required for: any `expo-*` dep change, `app.config.ts` native fields (permissions,
plugins, scheme), new permissions, Reanimated major bump, any change that produces a diff in
`npx expo prebuild` output.

Rule of thumb: if `git diff` touches `package.json` deps or `app.config.ts` → native rebuild +
bump `runtimeVersion` (currently `policy: 'appVersion'`, so bump the `version` field in
`app.config.ts`).

## Auth flow readiness

No auth flow exists yet. When adding authentication, use `<Stack.Protected guard={...}>` (Expo
Router v5+) rather than the old route-group redirect pattern (`(auth)`/`(app)` + `router.replace`).

## Known false positives

- `expo-doctor` warns about outdated `@types/react` sometimes — check if actually
  breaking before pinning.
- ESLint `import-x/no-cycle` can flag Expo Router `_layout` → screen → hook →
  `_layout` chains that are not real cycles. If confirmed safe, add an inline
  `// eslint-disable-next-line import-x/no-cycle` with a reason.

---

## Content variance

The rule: `AGENTS.md` § Critical rules › Content variance. Why, and what was measured: `DECISIONS.md`
§ Content variance on native: props, not pixels. Proving a guard can go red and naming the condition:
§ Verification integrity below.

The native axes are not the web ones. There is no `overflow-wrap` to forget; what breaks a screen is an
unbounded line count in a summary row, a row whose text sibling cannot shrink, and the accessibility
font slider against a fixed control height. Cap a summary line count (`numberOfLines` +
`ellipsizeMode`) and bound a label in a fixed-height control (`maxFontSizeMultiplier`); never
`allowFontScaling={false}`, which ignores the user's setting. States live in `src/test/contentStress.ts`.

RNTL cannot measure layout, and that limit is stated rather than worked around: it renders to a tree
with no layout engine, so a test asserts the PROPS that bound a layout and nothing about pixels. Some
props do not survive NativeWind's JSX interop into what RNTL exposes (measured on the button label,
whose rendered props are only `className` and `children`); there the assertion goes against the module
source with the reason next to it. Pixels need a device: `.maestro/`. Do not invent a way to LOOK; the
substitute ladder closes `READING_INDEX.md`.

## Verification integrity

Green means nothing until you know the gate can go red.

1. **Capture the exit code without a pipe**: `npm run verify:iter > /tmp/verify.log 2>&1; echo $?`. Piping
   to `tail` returns the PIPE's status, so a failed build reads as a pass.
2. **Mutation-check the tests**: if mentally reverting your change leaves the suite green, the test is
   worthless. Writing a test is the TDD step; proving it would have failed is this one.
3. **Prove a new gate gates**: break it on purpose once (an expired entry in
   `scripts/audit-allowlist.json`, a raw hex in a component, a staged `src` logic file with no `*.test.*`
   sibling) and watch it refuse. Then revert the sabotage.
4. **A check that reports success when it could not run is fail-OPEN.** Ask what it does on a missing
   directory, an empty result, or no network, not only on the failure it was written for.
5. **Name the condition under which the green would have been RED.** If you cannot name one, the check
   proved nothing, and a check that cannot fail still gets recorded as evidence. Two real shapes here:
   `jest --onlyChanged --passWithNoTests` (the iterate tier) exits 0 when the diff reaches no test at all,
   so a green `verify:iter` on an untested change proves nothing; and `jest --coverage` prints
   `Failed to collect coverage from <file>` for a file it could not parse and then exits 0 with a
   percentage over the smaller set, which is why `scripts/check-coverage.mjs` exists.
6. **Check the cases that "cannot happen".** For UI that is the shortest copy allowed, the longest, one
   unbroken token with nothing to wrap on, zero items, one item, many, plus the OS font scale, the axis
   with no web equivalent and the one most often missed. The states are in `src/test/contentStress.ts`.
7. **Know what RNTL structurally cannot see, and say so instead of faking it.** There is no layout engine
   behind the test renderer, so a test can assert the PROPS that bound a layout (`numberOfLines`,
   `maxFontSizeMultiplier`, a shrinking column) and nothing about the resulting pixels. Some props do not
   survive NativeWind's JSX interop into what RNTL exposes; there the honest assertion is against the
   module source, with the reason written next to it. Pixels need a device: that is what `.maestro/` is for.
