# Review instructions

Expo SDK 57 + React Native 0.86 template. Report correctness, security, accessibility and test strength
before style — style is ESLint's and Prettier's job, not a review finding.

## Non-negotiable

- `npm run verify` is the bar and it is zero-warnings (`eslint --max-warnings 0`,
  `oxlint --deny-warnings`). A change that needs a rule downgraded, a severity lowered, a coverage
  threshold moved, or an `eslint-disable` to pass is a finding, not a fix.
- **Everything `EXPO_PUBLIC_*` is public.** It is validated in `src/env.ts` and inlined into the JS
  bundle that ships to devices. A secret, key or admin endpoint under that prefix is a leak the moment it
  builds. Reading `process.env` anywhere but `src/env.ts` is blocked by a repo-local lint rule.
- **Tokens go to `expo-secure-store`** via `src/lib/secureToken.ts`. AsyncStorage is plaintext and is for
  cache only; a credential reaching it, a `persist` partialize, a log line or an analytics payload is a
  finding.
- **Deep links are untrusted input.** `useLocalSearchParams()` and `Linking` URLs come from other apps. A
  param that drives navigation, a fetch, or an authorisation decision needs validation.
- No secrets, keys or endpoints in committed files. `.env.example` carries placeholders; real values live
  in the environment or EAS secrets. This holds for values that look harmless.
- **`ios/` and `android/` are generated** by `expo prebuild` and are not committed. A diff that hand-edits
  native project files is a finding — the change belongs in `app.config.ts`.
- Native and Expo package versions come from `npx expo install --fix`, not from `npm outdated`. Bumping
  past the SDK list breaks Expo Go and jest-expo. `.cursor/brain/DECISIONS.md` lists the holds and why.

## Conventions the linter enforces — flag attempts to work around them

- Named constants, never bare numeric literals (`@typescript-eslint/no-magic-numbers`). Location is set by
  `.cursor/rules/constants.mdc`: co-locate for a single module, `src/store/<domain>/constants.ts` for
  store scope, `src/shared/lib/constants/` for cross-cutting.
- Colours come from a NativeWind class or from `COLOR_VALUES` in `src/shared/lib/theme/colors.ts`. Raw hex
  anywhere else under `src/` fails the gate.
- `className` only — no `StyleSheet`. `hover:` is a no-op on native; `active:` / `pressed:` are the real
  states.
- One-way FSD layer imports, enforced by `boundaries/dependencies`: `app` → `widgets` → `features` →
  `entities` (`src/store`) → `shared` (`src/lib`, `src/shared`), downward only.
- `@/` alias only. Parent-relative imports (`../..`) are blocked.
- Explicit in/out contracts: an explicit return type or a `FunctionComponent<Props>` annotation. Arrow
  functions, never function declarations. Interface callbacks use property style
  (`onSelect: (id: string) => void`), not method style.
- `logger` from `src/lib/logger.ts`, never `console.*`.
- Every user-visible string goes through `t()` with keys under `src/shared/locales/`. The only exception is
  the i18n-init fallback, which runs when `t()` cannot exist.

## Correctness patterns worth checking every time

- A test that still passes when the fix is reverted is not a test. Look for assertions that hold
  regardless of the behaviour under test.
- **RNTL 14 is async**: `render`, `renderHook`, `fireEvent`, `act` and `unmount` return promises. A missing
  `await` is a flake that surfaces in an unrelated spec.
- The `react-i18next` mock in `src/test/setup.ts` returns the KEY, not English copy. A test asserting on
  English text is asserting on the mock.
- Every `src` logic file needs a co-located `*.test.*`; the pre-commit hook enforces existence, not
  quality. Judge the quality.
- **Subscriptions need teardown**: `AppState`, `Keyboard`, `Dimensions`, `Linking`, navigation focus,
  timers, Reanimated shared values, store subscriptions. Count additions against removals in the diff.
  A leak on a mobile app process accumulates for days — there is no page reload.
- A `persist`-ed store is empty on first paint. A screen that reads it before `_hasHydrated` /
  `useStoreReady` shows wrong data for a frame, or forever if it reads once.
- Validate at boundaries with Zod (`src/lib/api/safeFetch.ts`). A response typed by assertion rather than
  parsed is trusted on faith.
- React Compiler is enabled, so manual `useMemo` / `useCallback` / `React.memo` is usually noise — but the
  compiler does **not** fix a wrong dependency array.
- A number that also appears inside a user-facing message must be interpolated from the same constant, or
  the two drift.
- Icon-only controls need `accessibilityLabel`; interactive elements need `accessibilityRole` and, where
  relevant, `accessibilityState`. Touch targets come from `src/shared/lib/theme/controlSizes.ts`.
- A list that can grow needs `FlatList` with `keyExtractor`, not `.map()`.
- Say whether the change is OTA-safe or needs a native rebuild. Any `expo-*` dependency change or
  `app.config.ts` native field means a rebuild plus a `version` bump.

## Conventions

- Conventional Commits, subject at most 96 characters.
- No ticket or task identifiers in code comments, test names, or commit messages. A comment states the
  constraint in plain words; traceability belongs to the branch and the pull request.
- English only in code, comments, commits and docs.
