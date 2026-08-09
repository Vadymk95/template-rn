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

## Commands / the gate

```bash
npm start            # Expo dev server (QR → Expo Go / Dev Client)
npm run verify       # every OFFLINE check: hooks → typecheck → oxlint → eslint → format → scripts → coverage
npm run verify:ci    # audit:gate (network) + verify — what husky pre-push AND CI both run
npm run fix          # the one remedy: oxlint --fix → eslint --fix → prettier --write
npm run ci:local     # verify:ci + expo-doctor (full local parity)
npm run bench:verify # per-step timings when the gate feels slow
npm run test:mutation # StrykerJS strength gate — weekly `mutation.yml` job, NOT in verify (2m per run)
```

**The gate contract**: `verify` is a strict superset of every offline check CI performs, and `verify:ci`
adds the one check that needs the network (`audit:gate`). The CI job is a single step over `verify:ci`.
A new check therefore goes into the **script**, never only into the workflow file — otherwise a green
local gate stops meaning a green pipeline.

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
