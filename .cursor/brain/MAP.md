# MAP — Where things live

## FSD layers (lint: `boundaries/dependencies`)

| Layer    | Directory                               |
| -------- | --------------------------------------- |
| app      | `src/app/`                              |
| widgets  | `src/widgets/`                          |
| features | `src/features/`, `src/hooks/`           |
| entities | `src/store/`                            |
| shared   | `src/lib/`, `src/shared/`, `src/env.ts` |

Imports flow **down-stack only** (app may use shared; shared must not import entities). Full rules: `.cursor/rules/fsd-layers.mdc`.

## i18n

| Need                                     | Where                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Bundled strings (per language)           | `src/shared/locales/<lng>/*.json`                                                                  |
| Init, `i18nInitPromise`, resource wiring | `src/shared/lib/i18n/index.ts`                                                                     |
| Typed keys (`t()` autocomplete)          | `src/shared/lib/i18n/resources.ts` + namespaces in `constants.ts`                                  |
| Init failure UI (no `t()`)               | `src/shared/lib/i18n/I18nInitErrorFallback.tsx`                                                    |
| Initial language from device             | `expo-localization` inside `index.ts` (add more `SUPPORTED_LANGUAGES` + JSON when you add locales) |

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

| Kind                                 | Lives in                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| Client state (UI, user session stub) | `src/store/<domain>/` (Zustand) — **entities**                 |
| Server state (API data)              | `src/features/<name>/` or `src/hooks/<domain>/` — **features** |
| Form state                           | _not wired — pick RHF or TanStack Form per product_            |
| Persistent secrets                   | `expo-secure-store` (add a `tokenStorage` wrapper per product) |
| Persistent non-secrets               | `AsyncStorage` (Zustand `persist` middleware)                  |

## Styling

| Need              | Where                                         |
| ----------------- | --------------------------------------------- |
| Tailwind config   | `tailwind.config.js`                          |
| Global CSS tokens | `global.css` (imported once in `_layout.tsx`) |
| Dark mode         | `useColorScheme` + `.dark` class at root      |
| Class merging     | `cn()` in `src/lib/utils.ts` (clsx-only)      |

## Infrastructure

| What                          | Where                                                 |
| ----------------------------- | ----------------------------------------------------- |
| Native iOS permissions        | `app.config.ts` → `ios.infoPlist`                     |
| Native Android permissions    | `app.config.ts` → `android.permissions`               |
| Bundle IDs (dev/preview/prod) | `app.config.ts` → `APP_VARIANT` env                   |
| EAS build profiles            | `eas.json`                                            |
| OTA update channel            | `app.config.ts` → `updates.url` + `runtimeVersion`    |
| CI (GitHub Actions)           | `.github/workflows/ci.yml` — same gates as `ci:local` |
| Path alias `@/*`              | `tsconfig.json` `paths` (single source of truth)      |
