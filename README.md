# template-rn

Production-ready foundation for React Native + Expo. The npm package name is
**`template-rn`** — use the same name for the repo folder and EAS slug so tooling stays aligned.
Strict types, validated env, file-based routing, declarative pipeline. **Opinionated starter** —
no vendor integrations (auth, crash reporting, forms libraries) baked in; pick those per product.
**Bundled i18next** (`src/shared/locales/`) is included for typed copy — not remote CMS.

**This is a scaffold, not a runnable project.** Install dependencies, then run
`npx expo prebuild` if you need native folders.

---

## Strict Contract

This template treats structure and quality as **enforced contract**, not team folklore.

- Human-facing contract: `docs/strict-template-contract.md`
- Agent rules: `.cursorrules` + `.cursor/rules/*.mdc`
- Verification matrix: `.cursor/brain/VERIFICATION.md`
- Route / widget / feature / store placement: `.cursor/brain/MAP.md` + `.cursor/rules/fsd-layers.mdc`

If you fork this template, keep those files in sync with your product decisions.

---

## Stack (April 2026)

| Layer          | Choice                                                                                              | Why                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Runtime        | React Native 0.83 + React 19.2                                                                      | Expo SDK 55 baseline                                                       |
| Framework      | Expo SDK 55                                                                                         | Stable since Jan 2026; Legacy Arch dropped                                 |
| Compiler       | React Compiler (stable)                                                                             | Auto-memoization via `experiments.reactCompiler`                           |
| Language       | TypeScript 5.9 strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`                   | Zero soft-land type escape hatches                                         |
| Routing        | Expo Router v55                                                                                     | File-based, typed routes, deep links                                       |
| Styling        | NativeWind 4.2 + Tailwind 3.4                                                                       | className-first; dark mode via `.dark`                                     |
| State (client) | Zustand 5 + `createSelectors`                                                                       | Minimal, no boilerplate                                                    |
| State (server) | TanStack Query 5 + AppState focus wiring                                                            | Queries refetch on app foreground                                          |
| Env            | `@t3-oss/env-core` + Zod                                                                            | Fail fast on missing vars                                                  |
| i18n           | `i18next` + `react-i18next` + JSON bundles + `expo-localization`                                    | Typed keys; add languages under `src/shared/locales/`                      |
| Forms          | `react-hook-form` + `@hookform/resolvers/zod`                                                       | Use when multi-field / schema validation; trivial `TextInput` → `useState` |
| Animation      | Reanimated 4 + `react-native-worklets`                                                              | UI-thread animations                                                       |
| Gestures       | `react-native-gesture-handler`                                                                      | Required by Reanimated / Router                                            |
| Storage        | `expo-secure-store` (secrets) + `@react-native-async-storage/async-storage` (cache)                 | Tokens are encrypted at rest                                               |
| Icons          | `@expo/vector-icons`                                                                                | Ships with Expo, 20+ icon sets, no extra install                           |
| Testing        | Jest + jest-expo + @testing-library/react-native (built-in matchers)                                | RN-native testing, no deprecated jest-native                               |
| Lint           | ESLint 9 flat + `eslint-config-expo` + `import-x` + Oxlint + React Compiler + TanStack Query strict | Same rules locally and in CI                                               |
| Format         | Prettier 3                                                                                          | Enforced via eslint-plugin-prettier                                        |
| Hooks          | Husky + commitlint + lint-staged                                                                    | Conventional commits, oxlint → eslint → prettier in staged                 |

---

## Why Expo (not bare React Native)

| Feature                            | Expo                                                      | Bare RN                         |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------- |
| Native dependencies                | Config plugins + `prebuild`                               | Manual Xcode / Gradle edits     |
| Build                              | **EAS Build** (cloud, no Mac needed)                      | Mac required for iOS            |
| OTA updates                        | **EAS Update** — push JS changes without App Store review | Manually integrate CodePush     |
| Upgrade path                       | `npx expo install --fix` aligns all native deps           | Manual diff, frequent breakage  |
| Continuous Native Generation (CNG) | `app.config.ts` is the source of truth                    | `ios/` / `android/` hand-edited |

**When to eject to bare:** you need a native module with no config plugin and
you can't write one. That's the 5% case. Start Expo managed.

---

## Folder structure

```text
src/
  app/                            # Expo Router route files only
    _layout.tsx                   # providers, splash, ErrorBoundary
    (tabs)/
      index.tsx                   # thin route -> mounts Todo workspace widget
      settings.tsx
    +not-found.tsx
  features/
    todo*/                        # user actions: create/edit/filter/toggle/delete
  widgets/
    todo-workspace/               # main screen composition for the starter slice
  store/
    todo/                         # local Todo domain state
    user/                         # example persisted auth-adjacent state
    utils/                        # createSelectors helper
  shared/
    ui/                           # reusable primitives: Button, Input, Dialog, ...
    lib/
      constants/                  # app-wide constants
      i18n/                       # bundled localization wiring
      theme/                      # spacing, radii, colors, control tokens
    locales/                      # bundled copy for tabs/routes/shared text
  lib/
    queryClient.ts                # TanStack Query + AppState focus
    logger.ts                     # pluggable logger stub
    utils.ts                      # cn() helper
  test/
    setup.ts                      # Jest/native mocks
  env.ts                          # Zod-validated EXPO_PUBLIC_* env
```

Template slice pattern:

```text
app route -> widget -> feature -> store/shared
```

---

## IDE workspace (Cursor / VS Code) — same bar as CI

This repo ships **`.vscode/settings.json`** (folder / workspace settings). When
everyone **opens the project folder** (File → Open Folder), they get:

- **Prettier** on save with **`.prettierrc.json`** + **`.editorconfig`** (`prettier.requireConfig: true` so there is no silent fallback formatter).
- **ESLint** flat config on type, **fix all ESLint fixes on save** (aligned with `npm run lint`).
- **Workspace TypeScript** from `node_modules/typescript` — same compiler as `npm run typecheck`.

**Recommended extensions** live in **`.vscode/extensions.json`** — accept
“Install Recommended Extensions” after clone (ESLint, Prettier, Tailwind, Expo,
Oxlint).

**Tasks (Terminal → Run Task):**

- **Verify (same gates as CI, no expo-doctor)** — default test task; matches
  GitHub Actions except `expo-doctor` (useful when Xcode on the machine is not
  pinned to Expo’s matrix yet).
- **Full local CI** — `npm run ci:local` including `expo-doctor`.

CLI equivalent of the default verify task:

```bash
npm run verify
# = typecheck → lint:oxlint → lint → format:check → test:coverage
```

If **`npm run format:check`** fails, run **`npm run format`** and commit — CI
runs the same check and will fail the PR with a red **Prettier** step.

---

## Post-edit pipeline

```bash
npm run typecheck && npm run lint && npm run test
```

Repo-wide contract gate:

```bash
npm run verify
```

Native / machine parity:

```bash
npm run ci:local
# = npm run verify + expo-doctor
```

---

## First-time setup

```bash
nvm use                           # reads .nvmrc
npm install
npx expo-doctor                   # verifies deps match SDK
npm start                         # QR code → Expo Go / Dev Client
npm run start:clear               # same, but resets the Metro cache
npm run start:tunnel              # QR/link over the internet (Expo Go / Dev Client)
npm run start:tunnel:clear        # tunnel + clean Metro cache
npm run ios                       # Mac only
npm run android
```

### Native tooling for local emulators

- **Android Studio**: install Android Studio + Android SDK + an emulator image,
  then set `ANDROID_HOME` and add the SDK `platform-tools` / `emulator` folders
  to `PATH`. After that, launch an AVD and run `npm run android`.
- **Xcode**: install Xcode from the App Store, open it once to finish setup,
  install command line tools with `xcode-select --install`, then use the iOS
  Simulator via `npm run ios`.
- **Mac-only note**: iOS Simulator requires macOS + Xcode. Android emulators
  work from Android Studio; cloud device builds still go through EAS.

### QR code, deep links, and "any internet"

- `npm start` / `npm run start:clear` uses your local network (same Wi-Fi).
- `npm run start:tunnel` (or `npm run start:tunnel:clear`) exposes the dev
  server through Expo's tunnel so Expo Go / a dev client can open the app from
  a QR code or shared `exp://` link even when the phone is not on the same LAN.
- This is a **development** workflow, not a production distribution channel. For
  production "open by link" behavior you still need proper deep links,
  Universal Links / App Links, and installed builds.

### Build profiles

- `development` — dev-client APK on Android and Simulator build on iOS, with a
  separate bundle id/package for local/native debugging.
- `preview` — internal QA/demo build distributed with EAS, same app shell style
  as release but not for the stores.
- `production` — release build for App Store / Play Store submission.

EAS build (no Mac needed):

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

OTA JS update:

```bash
eas update --branch production --message "Fix checkout button"
```

---

## What's intentionally not here

- **Native folders (`ios/`, `android/`)** — generated by `npx expo prebuild`.
- **Auth, forms, remote translation CMS, crash reporting** — product-specific.
  `logger.ts` is a stub with a stable API ready to be bound to Sentry / Datadog / Bugsnag.
- **E2E tests** — pick Maestro / Detox per product.
- **Native push setup** — covered in Expo docs, not in this skeleton.

---

## Mobile gotchas for web devs

1. **No `hover`** — NativeWind `hover:` classes are no-ops. Use `pressed:` / `active:`.
2. **Text must be inside `<Text>`** — bare strings in `<View>` crash the app.
3. **`console.log` in production** — only stripped if Babel plugin runs. This
   template includes `babel-plugin-transform-remove-console` (excludes `warn`/`error`).
4. **Keyboard covers inputs** — use `KeyboardAvoidingView` or add
   `react-native-keyboard-controller` when you hit it.
5. **Reanimated worklets plugin must be last** in `babel.config.js` — no compile
   error if you break it, just silent animation failures.
6. **Fast Refresh breaks on circular imports** — stricter than web HMR. The
   `import-x/no-cycle` ESLint rule catches these at lint time.
