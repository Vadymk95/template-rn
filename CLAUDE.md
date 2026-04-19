# template-rn

## Navigation

Always read `.cursor/brain/PROJECT_CONTEXT.md` before any task.
Architecture map: `.cursor/brain/MAP.md`
Verification (what to run per change): `.cursor/brain/VERIFICATION.md`

## Stack

Expo SDK 55 · React Native 0.83 · React 19.2 · TypeScript 5.9 strict · Expo Router v55 · NativeWind 4.2 (Tailwind 3.4) · Zustand 5 · TanStack Query 5 · Jest + jest-expo + @testing-library/react-native · React Compiler (stable)

## Critical Rules

**Expo Router** — file-based in `src/app/`. Route groups via `(folder)`. Typed routes enabled (`experiments.typedRoutes: true`).

**New Architecture is mandatory** in SDK 55 — don't re-add `newArchEnabled: true` to `app.config.ts`, it's a no-op now.

**React Compiler** is enabled (`experiments.reactCompiler: true`). Skip manual `useMemo`/`useCallback`/`React.memo` unless you hit a specific regression. Opt a file out with `"use no memo"` at the top.

**Reanimated 4 worklets plugin** — `react-native-worklets/plugin` in `babel.config.js`, must be LAST. The old `react-native-reanimated/plugin` path is gone.

**NativeWind** — `className` only, no StyleSheet. `hover:` classes are no-ops on native, use `active:` / `pressed:`.

**Components** — arrow-only; explicit props type + `: ReactElement` (or `FunctionComponent<Props>`). Expo routes: `const Screen = (): ReactElement => …; export default Screen`. Extract logic to `useComponentName.ts` next to heavy UI.

**Stores** — Zustand with `createSelectors`. Tokens go to `expo-secure-store`, not AsyncStorage.

**Imports** — `@/` alias only, no relative `../../`. Single source of truth is `tsconfig.json` `paths` (Metro SDK 55 reads it directly — no Babel plugin).

**Env** — all runtime config via `src/env.ts` (Zod-validated). Never read `process.env.*` directly.

**CNG** — `app.config.ts` is the source of truth. Do NOT hand-edit `ios/` or `android/` — regenerate via `npx expo prebuild --clean`.

**Logger** — never raw `console.error`. Always `logger.error(message, error, context)`.

**i18n** — user-visible strings go through `useTranslation` / `t()` and JSON under `src/shared/locales/`. Types: `src/shared/lib/i18n/resources.ts`. Init + fallback: `src/shared/lib/i18n/index.ts`, `I18nInitErrorFallback.tsx`. Only the init-fallback screen uses hardcoded English (no `t()`).

**Testing** — Jest + jest-expo + Testing Library in-repo. For native E2E later, add **Maestro** or **Detox**; **Playwright** is for browsers (use only if you enable Expo Web and want web E2E).

## Post-Edit Commands

Pick checks by task — `.cursor/brain/VERIFICATION.md`. Typical change:

```bash
npm run typecheck && npm run lint && npm run test
```

Full local CI (same as GitHub Actions):

```bash
npm run ci:local
```

## Commit Format

`type(scope): description` — max 96 chars
Types: `feat` `fix` `chore` `docs` `style` `refactor` `perf` `test` `revert` `build` `ci`
