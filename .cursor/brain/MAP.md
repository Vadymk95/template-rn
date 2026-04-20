# MAP — Where things live

## FSD layers (lint: `boundaries/dependencies`)

| Layer    | Directory                               |
| -------- | --------------------------------------- |
| app      | `src/app/`                              |
| widgets  | `src/widgets/`                          |
| features | `src/features/`, `src/hooks/`           |
| entities | `src/store/`                            |
| shared   | `src/lib/`, `src/shared/`, `src/env.ts` |

Imports flow **down-stack only** (app may use shared; shared must not import entities). Full rules: `.cursor/rules/fsd-layers.mdc`. Layer folders above may not exist until the first slice; boundaries still define where new files belong.

## i18n

| Need                                     | Where                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Bundled strings (per language)           | `src/shared/locales/<lng>/*.json`                                                                  |
| Init, `i18nInitPromise`, resource wiring | `src/shared/lib/i18n/index.ts`                                                                     |
| Typed keys (`t()` autocomplete)          | `src/shared/lib/i18n/resources.ts` + namespaces in `src/shared/lib/i18n/constants.ts`              |
| Init failure UI (no `t()`)               | `src/shared/lib/i18n/I18nInitErrorFallback.tsx`                                                    |
| Initial language from device             | `expo-localization` inside `index.ts` (add more `SUPPORTED_LANGUAGES` + JSON when you add locales) |

## Todo vertical slice (reference implementation)

| Concern                 | Where                                                   |
| ----------------------- | ------------------------------------------------------- |
| Screen orchestration    | `src/widgets/todo-workspace/TodoWorkspaceScreen.tsx`    |
| Feature actions/dialogs | `src/features/todo-*/` + `src/features/todo/`           |
| Client state            | `src/store/todo/todoStore.ts` + helpers in `store/todo` |
| Derived workspace logic | `src/features/todo/useTodoWorkspace.ts`                 |
| Copy namespace          | `src/shared/locales/en/todo.json`                       |

## Navigation & theme (no literals in layouts)

| Need                         | Where                                          |
| ---------------------------- | ---------------------------------------------- |
| Typed `href` / path literals | `src/shared/lib/constants/routes.ts`           |
| Expo Router segment names    | `src/shared/lib/constants/expoRouter.ts`       |
| Tab bar active tint (hex)    | `src/shared/lib/constants/navigationTheme.ts`  |
| Tab Ionicons glyph names     | `src/shared/lib/constants/tabBarIcons.ts`      |
| i18n init failure copy       | `src/shared/lib/constants/initFallbackCopy.ts` |

## Entry points

| What                                   | Where                                           |
| -------------------------------------- | ----------------------------------------------- |
| App entry                              | `expo-router/entry` (via `package.json` `main`) |
| Root layout (providers, ErrorBoundary) | `src/app/_layout.tsx`                           |
| First visible screen                   | `src/app/(tabs)/index.tsx`                      |
| Expo runtime config                    | `app.config.ts` (dynamic, env-driven)           |
| Env validation                         | `src/env.ts`                                    |

## Routing

| Need             | Where                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Add a new screen | Create file in `src/app/` — path = file path                                  |
| Add a tab        | File in `src/app/(tabs)/` + entry in `src/app/(tabs)/_layout.tsx`             |
| Add a modal      | New route under `src/app/` + `presentation: 'modal'` on the declaring `Stack` |
| 404              | `src/app/+not-found.tsx`                                                      |
| Typed navigation | `Link` / `router.push` — types generated from file tree                       |

## State

| Kind                                 | Lives in                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Client state (UI, user session stub) | `src/store/<domain>/` (Zustand) — **entities**                                          |
| Server state (API data)              | `src/features/<name>/` or `src/hooks/<domain>/` — **features**                          |
| Form state                           | `react-hook-form` + `@hookform/resolvers` (Zod); TanStack Form per product if preferred |
| Secrets that grant API access        | `src/lib/secureToken.ts` (thin `expo-secure-store` wrapper — extend keys per product)   |
| Persistent non-secrets               | `AsyncStorage` (Zustand `persist` middleware)                                           |

## Styling

| Need                   | Where                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Tailwind config        | `tailwind.config.js`                                                  |
| Global CSS tokens      | `global.css` (imported once in `_layout.tsx`)                         |
| Dark mode              | `useColorScheme` + `.dark` class at root                              |
| Class merging          | `cn()` in `src/lib/utils.ts` (clsx-only)                              |
| Theme token source     | `src/shared/lib/theme/` (`colors`, `spacing`, `typography`, `tokens`) |
| Reusable UI primitives | `src/shared/ui/` (`Button`, `Input`, `Dialog`, `Screen`, etc.)        |

## Infrastructure

| What                          | Where                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native iOS permissions        | `app.config.ts` → `ios.infoPlist`                                                                                                                            |
| Native Android permissions    | `app.config.ts` → `android.permissions`                                                                                                                      |
| Bundle IDs (dev/preview/prod) | `app.config.ts` → `APP_VARIANT` env                                                                                                                          |
| EAS build profiles            | `eas.json`                                                                                                                                                   |
| OTA update channel            | `app.config.ts` → `updates.url` + `runtimeVersion`                                                                                                           |
| CI (GitHub Actions)           | `.github/workflows/ci.yml` — same gates as `ci:local`                                                                                                        |
| Optional bundle metrics       | `scripts/capture-bundle-metrics.mjs`, `npm run perf:*`, `scripts/perf-program.md` — local baseline/check; wire into CI only if the team wants a numeric gate |
| Path alias `@/*`              | `tsconfig.json` `paths` (single source of truth)                                                                                                             |
