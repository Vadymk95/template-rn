# template-rn — agent guide

Production-ready React Native + Expo starter — Expo SDK 57, file-based routing, strict types, validated env, enforced quality contract. A scaffold, not a runnable project (install deps, then `npx expo prebuild` for native folders).

## Start here

1. Read `.cursor/brain/PROJECT_CONTEXT.md` before any task. Architecture map: `.cursor/brain/MAP.md`. What to run per change: `.cursor/brain/VERIFICATION.md`. Human-facing strict contract: `docs/strict-template-contract.md`.
2. `.cursor/rules/*.mdc` are **binding for the files they cover** — read the rules relevant to the area you touch before the first edit.

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

## Commands / the gate

```bash
npm start            # Expo dev server (QR → Expo Go / Dev Client)
npm run verify       # typecheck → oxlint → eslint → format:check → test:coverage (commit gate)
npm run ci:local     # verify + expo-doctor (full local parity)
```

The gate is **zero-warnings**: `eslint --max-warnings 0`, `oxlint --deny-warnings`. If it fails, fix the cause — do **not** downgrade rules, silence warnings, or sprinkle `eslint-disable`. If a rule is genuinely wrong for a class of files, add a documented file-scoped override in `eslint.config.mjs` stating why.

## Version holds (do not "fix" by bumping)

- **Native/Expo packages are SDK-pinned** — `react`, `react-native`, `react-native-*`, `expo-*` versions come from `npx expo install --fix`, NOT from `npm outdated`. Bumping past the SDK list breaks Expo Go / jest-expo.
- **Jest stays 29.x** — `jest-expo@57` is built on jest 29 internals (`babel-jest ^29.2.1`); `@types/jest` stays 29.x with it.
- **Tailwind stays 3.4.x** — NativeWind 4.x is built against the Tailwind 3 config format.
- **ESLint stays 9.x / TypeScript stays `~6.0.x` / `oxlint` tilde-tracks `eslint-plugin-oxlint`** — same ecosystem blocks as the sibling web templates (verified 2026-07-16).
- **`@expo/vector-icons` is deprecated upstream** (SDK 56+) but pinned explicitly and functional; migration path is `npx @react-native-vector-icons/codemod` — a deliberate follow-up, not a drive-by.
- **`overrides.uuid >= 11.1.1`** is a security floor for the `@expo/ngrok`/`xcode` dev chains — do not remove to quiet npm.

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
