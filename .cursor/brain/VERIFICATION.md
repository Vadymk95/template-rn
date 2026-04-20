# VERIFICATION — Which checks to run per change

Match the check to the change. Do not run `ci:local` for every file edit —
it takes minutes and depends on local native tooling. Run the targeted subset,
use `verify` as the repo-wide contract gate, and keep `ci:local` for native or
release parity.

## By change type

| Changed                               | Run                                                        |
| ------------------------------------- | ---------------------------------------------------------- |
| TS/TSX business code                  | `npm run typecheck && npm run lint && npm run test`        |
| Style-only (className tweaks)         | `npm run lint`                                             |
| `src/env.ts` or `.env`                | `npm run typecheck` + restart dev server                   |
| `app.config.ts`                       | `npx expo-doctor && npx expo prebuild --clean` (if native) |
| Native config plugin                  | `npx expo prebuild --clean && npm run ios` / `android`     |
| `package.json` dependency             | `npx expo install --fix && npx expo-doctor`                |
| `babel.config.js` / `metro.config.js` | Restart dev server with `--clear`                          |
| Test file only                        | `npm run test -- <path>`                                   |

## Repo-wide contract gate (before push / PR)

Run `npm run verify` — order: `typecheck` → `lint:oxlint` → `lint` →
`format:check` → `test:coverage`. This is the primary blocking quality gate for
the template and should stay green before pushing.

## Native / machine parity

Run `npm run ci:local` when:

- touching native config, Expo / build tooling, Metro / Babel, or dependencies
- preparing a release branch
- validating a machine against Expo tooling

`ci:local` = `npm run verify && npm run doctor`. `expo-doctor` is intentionally
kept out of the core repo contract because it depends on local native tooling.

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
