# VERIFICATION — Which checks to run per change

Match the check to the change. Do not run `ci:local` for every file edit —
it takes minutes and depends on local native tooling. Run the targeted subset,
use `verify` as the repo-wide contract gate, and keep `ci:local` for native or
release parity.

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
| Test file only                          | `npm run test -- <path>`                                    |

## What the git hooks enforce

- **pre-commit** — `lint-staged` (oxlint --fix → eslint --fix → prettier) on the staged
  files, then the TDD sibling gate (`scripts/check-test-siblings.mjs`, staged-only), then
  a **repo-wide** `lint:oxlint` + `format:check`. The repo-wide pass exists because
  `lint-staged` restores the _unstaged_ hunks of a partially staged file after fixing it
  — that is how "already formatted but never committed" files appear in the tree. Both
  repo-wide checks run before the hook decides, so one attempt reports everything.
  Remedy: `npm run fix && git add -u`.
- **commit-msg** — commitlint (Conventional Commits, subject ≤96 chars).
- **pre-push** — `npm run verify:ci`, the same script CI runs.

Not adopted: a hook that commits for you. A hook that creates commits hides what it
changed inside a commit you did not write, and the failure mode is a fix landing under an
unrelated message. The hook reports and refuses; the remedy is one command.

## Repo-wide contract gate (before push / PR)

Three rungs, and the split is deliberate:

- **`npm run verify:iter`** — the iteration rung: `lint:oxlint` → `typecheck` (incremental) →
  `jest --onlyChanged --passWithNoTests` (only tests git sees as affected by uncommitted work).
  Seconds; run it after every change — the full gate runs ONCE, before the task is reported done.
  `--onlyChanged` follows the module graph from changed files, so cross-cutting suites and
  `scripts/**` tests (`test:scripts`) surface at the full-gate run, not during iteration.
- **`npm run verify`** — every check that works OFFLINE, in order: `check-hooks` →
  `lint:oxlint` → `format:check` → `typecheck` → `lint` (cached) → `test:scripts` →
  `test:coverage` — cheap independent stages first. An implementer with no network can
  still run the whole thing. **No gate preflight here, deliberately:** this gate has no
  production build, no e2e port and no required env, so every candidate check would be
  one that cannot fail — and a check that cannot fail only claims coverage.
- **`npm run verify:ci`** — `audit:gate` (needs the registry) + `verify`. This is
  what husky pre-push runs and what the CI job runs, as a single step.

`verify` is a **strict superset of the offline checks CI performs**. The rule that
keeps it that way: a new check goes into the script, never only into
`.github/workflows/ci.yml`. A check that lives only in the workflow means a green
local gate no longer predicts a green pipeline — which is the exact failure this
contract exists to remove.

`npm run test:mutation` sits on neither rung on purpose: it runs weekly via the
`mutation.yml` cron, never as part of `verify` — see AGENTS.md § Mutation testing.

Read the exit code without a pipe — `npm run verify > /tmp/verify.log 2>&1; echo $?`.
Piping to `tail` returns the pipe's status, so a failed run reads as a pass.

When it fails: `npm run fix && git add -u` for lint/format findings. Never lower a
severity, move a coverage threshold, or extend an ignore list to reach green.

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

Any component that renders authored copy must be proven against content it has not seen. The states live
in `src/test/contentStress.ts`: `minimal` / `typical` / `long` / `unbroken` for text, `none` / `one` /
`many` for collections, plus the OS **font scale** — the axis with no web equivalent, and the one that
breaks a fixed-height control.

What this template can and cannot check, stated rather than implied:

- **It can assert the PROPS that bound a layout** — `numberOfLines` + `ellipsizeMode` on a summary row,
  a text column that can shrink, `maxFontSizeMultiplier` on a label inside a fixed-height control.
- **It cannot assert pixels.** RNTL renders to a tree with no layout engine behind it. There is no
  browser to measure in, so unlike the web siblings there is no geometry harness here; the device run is
  `npm run maestro`, and it is not in the gate.
- **Some props do not survive NativeWind's JSX interop** into what RNTL exposes — measured on the button
  label, whose rendered props are only `className` and `children`. Where that happens the assertion goes
  against the module SOURCE with the reason next to it, because a render assertion would be permanently
  red for a correct component.

Green also means nothing until you have seen the check go red. When you add or change a guard, remove it
once on purpose and confirm the test refuses, then revert — both guards here were proven that way.

**Before believing a green result, name the concrete condition under which it would have been RED.** If
you cannot name one, the check proved nothing, and a check that cannot fail still gets recorded as
evidence.
