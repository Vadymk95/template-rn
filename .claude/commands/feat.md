---
description: Implement a feature in this repo — scope, reuse check, plan, TDD, gate
---

Implement `$ARGUMENTS` in this repo. The process below is the repo-local version: it names this repo's
actual gate, its actual reuse locations and its actual danger zones, so nothing has to be guessed.

## 1. Discovery

1. `.cursor/brain/SKELETONS.md` — does the task touch a danger zone? `app.config.ts`, `babel.config.js`,
   `metro.config.js`, `src/lib/queryClient.ts`, `src/lib/secureToken.ts`, `src/lib/storageKeys.ts`, a
   `persist`-ed store, `src/app/_layout.tsx`, `tsconfig.json` `paths`, `src/env.ts`. If yes, that section
   governs the task and you flag the risk before planning.
2. `.cursor/brain/MAP.md` for placement and the Todo reference slice; `.cursor/rules/fsd-layers.mdc`
   whenever the task adds imports or new paths under `src/`.
3. The other `.cursor/rules/*.mdc` whose `globs` match the files you will touch. Only those. State which
   you loaded.
4. **Reuse check — a hard gate, not advice.** Before planning any new function, hook, component or
   constant, search for an existing equivalent by name AND by synonym in the places this repo keeps them:
   `src/lib/` (`utils`, `logger`, `queryClient`, `api/safeFetch`, `secureToken`, `storageKeys`),
   `src/hooks/`, `src/shared/ui/` (Button, Card, Dialog, EmptyState, FilterChip, IconButton, Input,
   Screen, ScreenHeader, SectionHeader — never hand-roll one that exists), `src/shared/lib/theme/`
   (radii, spacing, typography, control sizes, colour values), `src/shared/lib/constants/`, `src/store/`.
   Shipping a parallel implementation of something that exists is a violation, not a style choice.

## 2. Scope, out loud, before any edit

Two lists: **in scope** and **explicitly out of scope**. Name the danger zones touched, or say "none".
Name what you are reusing (`Reusing: …`) — an empty reuse list on a non-greenfield task means step 1.4
was not really done. Say whether the change is **OTA-safe or needs a native rebuild** (any `expo-*`
dependency change or `app.config.ts` native field means rebuild plus a `version` bump — see
`VERIFICATION.md`).

If a blocking requirement is unclear, ask **one** question at a time and propose your recommended answer
with it. Resolve from the codebase or the brain instead of asking whenever the answer is discoverable
there.

Wait for approval when the task touches a danger zone, a Zustand store or TanStack Query contract, an API
payload shape, native config, or the router. Trivial leaf edits proceed with a brief note.

## 3. Build

- **Logic first, test-first**: for stores (`src/store/**`), hooks (`src/hooks/**`) and `src/lib` modules,
  write the failing test, then the code. Say what the test asserted while it was red.
- **UI**: implement, then cover it with `@testing-library/react-native`. RNTL 14 is async — `render`,
  `renderHook`, `fireEvent`, `act` and `unmount` all return promises and must be awaited. An un-awaited
  `unmount()` poisons the next test's render.
- Max two files per iteration without an intermediate check.
- Every `src` logic file needs a co-located `*.test.*` — the pre-commit hook refuses otherwise. Write the
  test because it is worth having, not to satisfy the hook.
- Match the surrounding file exactly: 4-space indent, single quotes, arrow-only components with an
  explicit return type, `@/` imports (never `../..`), property-style interface callbacks, `className`
  never StyleSheet, tokens never raw hex, named constants never bare numbers, `t()` for every
  user-visible string, `logger` never `console`, `expo-secure-store` for anything that grants API access.
- React Compiler is on: skip manual `useMemo` / `useCallback` / `React.memo` unless you hit a measured
  regression.

## 4. Verify

```bash
npm run verify > /tmp/verify.log 2>&1; echo $?
```

Exit code **without a pipe**. Then: revert your change mentally and ask which of your new tests would
still pass. Any that would is worthless — fix it before reporting.

If the gate fails, fix the cause. `npm run fix && git add -u` handles lint and formatting. Do not lower a
severity, add an `eslint-disable`, move a coverage threshold, or extend an ignore list to get green.

## 5. Report and stop

- Files changed, and what each does.
- **What you deliberately did not touch**, and why. This is the auditable half.
- OTA-safe, or needs a native rebuild — say which.
- Which brain file needs an update (`MAP.md` for new wiring, `DECISIONS.md` for a trade-off,
  `SKELETONS.md` for a new risk), or `Brain sync: none needed`.
- Anything you flagged instead of forcing.
- `Confidence: HIGH | MEDIUM | LOW — reason`.

Do not commit. Do not push.
