# Template reset

This template ships with a working Todo workspace so a new repo starts with real routing, state, UI composition, tests, and i18n wiring instead of placeholder files. Keep that foundation, but treat the Todo slice as disposable example product code.

## Keep

- Expo Router structure under `src/app/**`, where route files stay small and mostly mount widgets or screens.
- Shared app infrastructure: i18n, env validation, query client, logger, testing, linting, and theme primitives.
- Reusable UI and composition patterns in `src/shared/**` and `src/widgets/**` when they still fit your product.

## Replace first

Replace the Todo example slice first. That usually means the workspace screen, related feature widgets, and the `src/store/todo/**` state model. Route, tab, and Todo example copy now live in `src/shared/locales/**`, so replacing the slice should update those locale files together with the feature code.

The first tab is the start guide (`src/widgets/start-guide/`, mounted by `src/app/(tabs)/index.tsx`): a pointer into this repo for whoever just cloned it, not product code. Delete it together with its copy, or point the route at your own first screen.

Nothing that guards the repo cites this sample code. `AGENTS.md`, `.cursor/rules/**` and `.claude/commands/**` name no file of the Todo slice or the start guide, so deleting either never changes a gate file and never needs a `gate-change` label. What does cite them is the repo's own description of itself: `npm run docs:check` fails on each backticked path that no longer exists, and the list it prints is the list of lines to edit (`.cursor/brain/MAP.md` carries a "Start guide" and a "Todo vertical slice" table; `README.md` and `.cursor/brain/PROJECT_CONTEXT.md` name the slices too).

## Suggested order

1. Rename the product in docs, app config, and localized copy under `src/shared/locales/**`.
2. Swap the Todo route composition for your first real user workflow.
3. Replace the Todo store, types, and feature logic with your domain model.
4. Keep reusable shared UI only where it still serves the new product.
5. Remove leftover example tests and copy once your own slice is covered.

## Growing into an MVP

Start with one real workflow end to end: route, widget, state, validation, and tests. After that, add the product-specific integrations this template intentionally leaves open, such as auth, API data fetching, analytics, crash reporting, offline behavior, or richer media/performance tooling. Add each one only when the MVP truly needs it.

## Governance files to revisit after a fork

When the new product stops looking like the Todo example, review these files together:

- `docs/strict-template-contract.md` — the template's human-facing engineering law
- `.cursor/brain/VERIFICATION.md` — what is blocking locally and in CI
- `AGENTS.md`, `.cursor/rules/*.mdc` and `.claude/commands/*.md` — what future agents will treat as hard guidance
- `eslint.config.mjs` and any repo-owned lint rules — what the tooling forbids mechanically
- `src/shared/locales/**` — route, tab, and product copy that ships in the bundle

## Decisions and version holds

The template's decisions are about the template. Your fork starts its own record and keeps the guard on held packages.

- [ ] Replace `.cursor/brain/DECISIONS.md` with a fresh file: one header line saying history lives in `git log -p -- .cursor/brain/DECISIONS.md` and in the template repository (`https://github.com/Vadymk95/template-rn`), then your own entries, each at most 30 lines (context, decision, consequences, status, evidence link). Delete what turns out wrong or dead; git keeps the history.
- [ ] Keep `scripts/version-holds.json` and `scripts/check-version-holds.mjs`. The holds are facts about packages (SDK-pinned natives, Jest 29, Tailwind 3.4, TypeScript, ESLint), not about the template, and `verify` fails a manifest, lockfile or Dependabot `ignore` that drifts from them.
- [ ] Re-check every hold against your own Dependabot PRs. A PR for a held package is the signal to test the hold's lift condition: lift it by editing `scripts/version-holds.json`, `package.json` and `.github/dependabot.yml` in one change, or close the PR.

## CodeQL in a private fork

`security.yml` runs `codeql` on every pull request and `.github/ruleset.json` requires its check,
`CodeQL (JavaScript / TypeScript) (javascript-typescript)`. Code scanning is free on a public repository; a private
one needs a GitHub Code Security license, which only a GitHub Team or GitHub Enterprise plan can buy. Without it the
job fails with "Code scanning is not enabled for this repository", and a check that can never pass teaches people
to ignore red. Sources, with the exact wording: `README.md` § Pipelines — and which ones survive a private fork.

- [ ] Private repository: get the license, or delete the `codeql` job in `.github/workflows/security.yml` and the
      required check `CodeQL (JavaScript / TypeScript) (javascript-typescript)` in `.github/ruleset.json` in one
      commit. This template is public and keeps both.

## Placeholder replacement checklist

Every fork must update these values before shipping. Each item names the file and the symbol in it, never a line number (a line moves with every edit); search for the symbol if it has moved.

### Bundle identifiers (iOS + Android)

- [ ] `app.config.ts` `getBundleId()` — replace `com.example.templatern.dev`
- [ ] `app.config.ts` `getBundleId()` — replace `com.example.templatern.preview`
- [ ] `app.config.ts` `getBundleId()` — replace `com.example.templatern`

### App display names

- [ ] `app.config.ts` `getAppName()` — replace `Template RN (Dev)`
- [ ] `app.config.ts` `getAppName()` — replace `Template RN (Preview)`
- [ ] `app.config.ts` `getAppName()` — replace `Template RN`

### Slug and deep link scheme

- [ ] `app.config.ts` `slug` — replace slug `template-rn`
- [ ] `app.config.ts` `scheme` — replace scheme `templatern` (lowercase, no spaces; forms `yourapp://` URLs)
- [ ] `package.json` `name` — align it with the new slug

### Assets (replace the 70-byte placeholder PNGs)

- [ ] `assets/icon.png` — 1024×1024 app icon; referenced by `icon` in `app.config.ts`
- [ ] `assets/splash.png` — splash image; referenced by the `expo-splash-screen` plugin options in `app.config.ts`
- [ ] `assets/adaptive-icon.png` — Android foreground; referenced by `android.adaptiveIcon.foregroundImage` in `app.config.ts`, paired with its `backgroundColor`

### EAS (only if using EAS Build / Update)

- [ ] Run `eas project:create`, capture the project ID
- [ ] Set `EAS_PROJECT_ID` in CI secrets and local `.env` for OTA; `app.config.ts` gates `extra.eas` and `updates.url` on its presence (`easProjectId` in `app.config.ts`)
- [ ] Update `eas.json` profiles if the slug or per-profile env changed

### Legal

- [ ] Replace the copyright holder if forking under a different author

### Example / demo content to strip

- [ ] `src/shared/locales/en/todo.json` — delete if removing the Todo slice, then mirror the deletion in `src/shared/lib/i18n/constants.ts` (`DEFAULT_NAMESPACES`), `src/shared/lib/i18n/index.ts`, `src/shared/lib/i18n/resources.ts`
- [ ] `src/widgets/start-guide/` and `src/shared/locales/en/start.json` — the first tab's content; mirror the locale deletion in the same three i18n files, and replace what `src/app/(tabs)/index.tsx` mounts (its tab entry lives in `src/app/(tabs)/_layout.tsx`)
- [ ] `.cursor/brain/MAP.md` ("Start guide" and "Todo vertical slice"), `README.md` (the `src/` tree), `.cursor/brain/PROJECT_CONTEXT.md` (Architecture) — rewrite the lines `npm run docs:check` reports once the slices are gone
- [ ] `.maestro/smoke.yaml`, `.maestro/create-task.yaml` — hardcoded Todo copy and `testID`s; rewrite or delete with the slice
- [ ] `scripts/perf-baseline.json` — regenerate via `npm run perf:baseline` once the product bundle shape stabilizes
