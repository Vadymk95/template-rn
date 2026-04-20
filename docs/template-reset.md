# Template reset

This template ships with a working Todo workspace so a new repo starts with real routing, state, UI composition, tests, and i18n wiring instead of placeholder files. Keep that foundation, but treat the Todo slice as disposable example product code.

## Keep

- Expo Router structure under `src/app/**`, where route files stay small and mostly mount widgets or screens.
- Shared app infrastructure: i18n, env validation, query client, logger, testing, linting, and theme primitives.
- Reusable UI and composition patterns in `src/shared/**` and `src/widgets/**` when they still fit your product.

## Replace first

Replace the Todo example slice first. That usually means the workspace screen, related feature widgets, and the `src/store/todo/**` state model. Route, tab, and Todo example copy now live in `src/shared/locales/**`, so replacing the slice should update those locale files together with the feature code.

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
- `.cursorrules` and `.cursor/rules/*.mdc` — what future agents will treat as hard guidance
- `eslint.config.mjs` and any repo-owned lint rules — what the tooling forbids mechanically
- `src/shared/locales/**` — route, tab, and product copy that ships in the bundle

## Placeholder replacement checklist

Every fork must update these values before shipping. `file:line` refs are valid as of this commit; re-grep if files drift.

### Bundle identifiers (iOS + Android)

- [ ] `app.config.ts:11` — replace `com.example.templatern.dev`
- [ ] `app.config.ts:12` — replace `com.example.templatern.preview`
- [ ] `app.config.ts:13` — replace `com.example.templatern`

### App display names

- [ ] `app.config.ts:17` — replace `Template RN (Dev)`
- [ ] `app.config.ts:18` — replace `Template RN (Preview)`
- [ ] `app.config.ts:19` — replace `Template RN`

### Slug and deep link scheme

- [ ] `app.config.ts:25` — replace slug `template-rn`
- [ ] `app.config.ts:29` — replace scheme `templatern` (lowercase, no spaces; forms `yourapp://` URLs)
- [ ] `package.json:2` — align `name` with the new slug

### Assets (replace the 70-byte placeholder PNGs)

- [ ] `assets/icon.png` — 1024×1024 app icon; referenced at `app.config.ts:28`
- [ ] `assets/splash.png` — splash image; referenced at `app.config.ts:32` and `app.config.ts:79`
- [ ] `assets/adaptive-icon.png` — Android foreground; referenced at `app.config.ts:65`, paired with `backgroundColor` at line 66

### EAS (only if using EAS Build / Update)

- [ ] Run `eas project:create`, capture the project ID
- [ ] Set `EAS_PROJECT_ID` in CI secrets and local `.env` for OTA; `app.config.ts` gates `extra.eas` and `updates.url` on its presence (lines 89–99)
- [ ] Update `eas.json` profiles if the slug or per-profile env changed

### Legal

- [ ] Replace the copyright holder if forking under a different author

### Example / demo content to strip

- [ ] `src/shared/locales/en/todo.json` — delete if removing the Todo slice, then mirror the deletion in `src/shared/lib/i18n/constants.ts:14`, `src/shared/lib/i18n/index.ts`, `src/shared/lib/i18n/resources.ts`
- [ ] `.maestro/smoke.yaml`, `.maestro/create-task.yaml` — hardcoded Todo copy and `testID`s; rewrite or delete with the slice
- [ ] `scripts/perf-baseline.json` — regenerate via `npm run perf:baseline` once the product bundle shape stabilizes
