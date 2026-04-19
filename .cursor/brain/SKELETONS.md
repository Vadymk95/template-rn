# SKELETONS — Danger zones

Files where a wrong edit breaks the app silently or in production only.
Touch with intent; re-verify via the commands in `VERIFICATION.md`.

## `app.config.ts`

- `bundleIdentifier` / `package` change = new app in stores (users lose data)
- `scheme` change = all existing deep links break
- `runtimeVersion.policy` change = OTA updates stop working for old clients
- Removing a permission `infoPlist` key that code still uses = App Store rejection
- New `plugins: [...]` entry requires `npx expo prebuild --clean` before build
- `experiments.reactCompiler: true` — disabling it silently changes render behavior
  in components that rely on auto-memoization

## `babel.config.js`

- `react-native-worklets/plugin` MUST be last in `plugins`. Breaking this =
  silent animation failures, no compile error. (Reanimated 4 moved its plugin
  to the separate `react-native-worklets` package — do not use the old
  `react-native-reanimated/plugin` path.)
- `nativewind/babel` must appear in `presets`, not `plugins`.

## `metro.config.js`

- `withNativeWind(config, { input: './global.css' })` — path must match the
  actual CSS file. Wrong path = no styles, no error.

## `src/lib/queryClient.ts`

- `AppState` listener must register at module load. Moving it into a hook =
  queries never refetch on foreground in production.

## `src/store/user/userStore.ts` (and any `persist`-ed store)

- `partialize` controls what lands in AsyncStorage. Accidentally persisting a
  token = plaintext leak. Tokens belong in `expo-secure-store`.

## `src/app/_layout.tsx`

- Provider order matters: `GestureHandlerRootView` → `SafeAreaProvider` →
  `QueryClientProvider` → `Stack`. Swapping causes gesture handlers to fail on
  Android only (iOS hides the bug).
- `ErrorBoundary` exported from `expo-router` — must be a named re-export at
  module top level, otherwise Expo Router cannot find it.

## `tsconfig.json` `paths`

- `@/*` maps to `./src/*`. This is the **only** place path aliases are defined.
  Metro (SDK 55+) resolves them directly. Do not re-add
  `babel-plugin-module-resolver` — duplicated config drifts silently.

## `.env` and `src/env.ts`

- `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time. They
  are NOT secrets — never put API keys with billing power here.
- Adding a new var requires editing `.env.example`, `src/env.ts` schema, AND
  restarting Metro (env is read once).
