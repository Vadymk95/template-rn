---
description: Write tests for the change that hunt corner cases at integration seams, not the happy path
---

Write or strengthen tests for what changed. The default failure mode this command exists to prevent is
**characterisation**: tests that describe what the code currently does, pass immediately, and would keep
passing if the behaviour were reverted. Those cement the flow instead of guarding it.

## 1. Scope to the change

```bash
git diff --name-only origin/master...HEAD
git status --short
```

Testable: `src/**` logic — stores, hooks, `src/lib`, features, widgets, `src/shared/ui`. Skip: `src/app/**`
route shells, types-only files, `constants.ts` tables, locale JSON, config. If nothing testable changed,
say "no testable changes" and stop.

List what the branch **already** tests for these files — update the existing spec rather than adding a
parallel one.

## 2. Reuse this repo's test infrastructure — do not invent

- `src/test/setup.ts` is the single place native modules are mocked: `expo-localization`,
  `react-i18next` (its `t` returns the key, or `namespace:key` — assert on keys, never on English copy),
  AsyncStorage, `expo-secure-store`, gesture handler, safe-area, `expo-router`, `expo-splash-screen`,
  Reanimated, NativeWind. **Add a shared mock there, not inline in a spec.** A second inline copy of an
  existing mock is a violation.
- A recent nearby spec is the reference for imports and assertion style — `src/store/todo/todoStore.test.ts`
  for stores, `src/features/todo/useTodoWorkspace.test.ts` for hooks,
  `src/widgets/todo-workspace/TodoWorkspaceScreen.test.tsx` for screen-level integration.
- `src/lib/api/safeFetch.test.ts` shows how a boundary is tested: mock the global `fetch`, feed it a
  payload that violates the Zod schema, assert the parse fails rather than the type assertion passing.

**RNTL 14 is async.** `render`, `renderHook`, `fireEvent`, `act` and `unmount` all return promises and must
be awaited. An un-awaited `unmount()` leaks into the next test's render, which surfaces as an unrelated
spec failing. Queries skip accessibility-hidden elements — pass `{ includeHiddenElements: true }` to reach
a deliberately hidden node such as a dialog backdrop.

## 3. Decide the coverage LEVEL before writing

Grep each changed module's consumers. If it is used in more than one place, or its behaviour depends on
what a parent wires into it (store, provider, navigation params, props), unit tests alone are **not**
enough — render it through the real parent path as well. A component whose unit tests are green and which
breaks when mounted inside a screen is the exact failure this rule exists for.

Single-consumer leaf with pure props: unit coverage is enough. Say so explicitly.

## 4. Enumerate corner cases at the seams

This is the substance of the command. For every changed unit, walk these axes and write down which apply
— then test those, not the happy path:

- **Async transitions.** loading → loaded, loading → error, error → retry → loaded. The intermediate state
  is where stale data and double-fetches live. A test that only asserts the settled state cannot see them.
- **Identity switches.** A → B while a request for A is still in flight. Does B render A's data? Does the
  store keep A's entry? This is the classic stale-state bug and it never shows on a single-entity test.
- **Store hydration.** A `persist`-ed store has a real "not hydrated yet" state (`_hasHydrated`,
  `useStoreReady`). Assert the pre-hydration render, not just the settled one — a screen that reads an
  empty persisted store on first paint is a real bug class here.
- **Boundaries, from both sides.** For a rule at N, assert N and N-1. Empty, one, many. First and last.
  Zero results versus a failed request — they are different and often collapse into the same branch by
  accident.
- **Contract seams between modules.** Where your change crosses a boundary — component to hook, hook to
  store selector, api function to Zod schema — assert the shape that crosses it. A response typed by
  assertion instead of parsed with `safeFetch` is trusted on faith; test what happens when the shape is
  wrong.
- **Error mapping.** Each distinct status or error code that maps to a distinct user-visible message needs
  its own case. One test for "it shows an error" hides the mapping entirely.
- **A number that appears twice.** If a limit lives in a rule and also in the copy advertising it, one
  test must pin both, or they drift.
- **Cleanup.** Unmount mid-flight. A listener that outlives the component: `AppState`, `Keyboard`,
  `Dimensions`, a navigation focus listener, a timer, a Reanimated shared value. Assert the subscription
  is removed, not merely that the component unmounted without throwing.
- **Colour scheme.** Anything that reads `useColorScheme()` has a second path. Both need a case.

For anything in `.cursor/brain/SKELETONS.md`, at least one case beyond the happy path is mandatory.

## 5. Prove each test can fail

For every test written: revert the behaviour it guards and confirm it goes red. Report what you reverted
and what failed. A test you did not see fail is a test you are guessing about.

Every test needs a meaningful assertion. `expect(true).toBe(true)`, `expect(x).toBeTruthy()` on a value the
test just built, and a `waitFor` whose body cannot throw all count as no assertion at all.

## 6. Run them the way the gate does

```bash
npm run test:coverage > /tmp/test.log 2>&1; echo $?
```

Coverage thresholds only enforce with `--coverage`, so bare `npm test` proves less than it looks like. If a
threshold fails, name the file that dragged it down and propose tests — never lower the threshold or extend
`collectCoverageFrom`'s exclusion list.

## 7. Report

Written / updated / skipped, with the reason for each skip. Then: which corner-case axes from step 4
applied and are now covered, which applied and are **not** covered and why, and what you reverted to prove
the tests fail. End with `Confidence: HIGH | MEDIUM | LOW — reason`.
