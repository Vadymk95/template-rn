---
description: Act as a senior reviewer on the working diff — leaks, security, bug hunt, tests
---

You are the reviewer on this diff. Not the author, not a linter. Your job is to find what the gate cannot:
leaks, unsafe paths, wrong behaviour under conditions nobody ran, and tests that only look like tests.
Report; do not fix unless asked.

## 0. Establish the diff

```bash
git status --short
git diff                       # unstaged
git diff --cached              # staged
git diff origin/master...HEAD  # committed on a branch
```

Every finding must sit on a line this diff touches. Whole-file context tempts you toward legacy code; that
temptation is how a one-file fix becomes a refactor. Pre-existing problems get named separately as
"pre-existing, not this diff" — never mixed into the findings.

Load `.cursor/brain/SKELETONS.md`. If the diff enters a danger zone, that section IS the review.

## 1. Mechanical pass first, judgement second

Read every changed line before forming an opinion. Judgement-first review allocates attention, and
allocating means skipping — a uniform pass has no earlier verdict of its own to defend.

Every round — findings or acceptance — gets the diff read plus the iteration tier, run yourself and
never on the author's word. The full chain belongs to the push hook and CI; acceptance does not
pre-run it (tier law: `AGENTS.md` § Commands / the gate):

```bash
npm run verify:iter > /tmp/verify.log 2>&1; echo $?
```

Exit code **without a pipe**: piping to `tail` returns the pipe's status, so a failed run reads as a pass.

## 2. Leak hunt (React Native)

Walk each changed component and hook against this list. Most are invisible in tests and in one manual pass
on a simulator, and on a phone they accumulate across a session instead of being wiped by a page reload.

- **`useEffect` with no cleanup** where one is needed. In this stack that means `AppState.addEventListener`
  (see `QueryClientAppStateBridge` for the correct shape — `sub.remove()` in the teardown),
  `Keyboard.addListener`, `Dimensions.addEventListener`, `Linking.addEventListener`, a navigation focus
  listener, `setInterval` / `setTimeout`, a Zustand or Query subscription, an `AbortController` for an
  in-flight fetch. Each needs its teardown in the returned function. Count subscriptions against
  removals across the whole diff; the numbers should match.
- **State set after unmount** — an async handler that resolves late and calls a setter. Look for `await`
  followed by a setter with no abort signal and no mounted guard. On native this is a warning-free leak.
- **Reanimated / worklets**: a shared value or animation started in an effect and never cancelled; a
  worklet closing over a value that outlives the component.
- **Stale closure**: a callback captured with an empty or incomplete dependency array that reads a value
  which changes. Check every dependency array in the diff against the identifiers in its body. React
  Compiler memoises automatically — it does **not** fix a wrong dependency list.
- **Identity churn**: an object, array or function literal created in render and passed as a prop or a
  dependency. It can drive an effect on every render.
- **Module-scope accumulation**: a `Map`, `Set`, array or cache declared at module level that only grows.
  It survives every unmount for the life of the app process — and a mobile app process lives for days.
- **`persist` middleware**: a store that writes on every keystroke, or persists data it should not (see
  the security pass).
- **Images and lists**: a list rendered with `.map()` where the data can grow — no windowing, so every row
  stays mounted. Remote images with no dimensions.

## 3. Security pass

- **Everything `EXPO_PUBLIC_*` is public.** `src/env.ts` validates it and the value is inlined into the JS
  bundle, which ships to devices and can be read from any installed app. A secret, private key or admin
  endpoint introduced under an `EXPO_PUBLIC_` name is a leak the moment it builds. Flag any new
  `EXPO_PUBLIC_` variable and ask what it holds. Reading `process.env` outside `src/env.ts` is blocked by
  a repo-local lint rule — flag any attempt to work around it.
- **Token storage.** Anything that grants API access goes to `expo-secure-store` via
  `src/lib/secureToken.ts` — Keychain on iOS, EncryptedSharedPreferences on Android. AsyncStorage is
  **plaintext** and is for cache only. A token, refresh token or session id reaching AsyncStorage, a
  Zustand `persist` partialize, a log line or an analytics payload is a finding.
- **The client is not a security boundary.** Any check the diff adds that gates access, price, entitlement
  or role must exist on the server too. Client-side gating is UX.
- **Unvalidated boundaries**: a `fetch` whose result is typed by assertion instead of parsed by
  `src/lib/api/safeFetch.ts`. Spreading an unvalidated object into a store is also prototype-pollution
  surface.
- **Deep links are untrusted input.** `useLocalSearchParams()` and any `Linking` URL come from outside the
  app — another app can open your `scheme://` with anything. A param used to navigate, to fetch, or to
  decide authorisation needs validation and an allowlist.
- **`app.config.ts`**: a new permission, a new plugin, a changed bundle id / scheme, or anything landing in
  `extra` (which ships in the manifest and is readable). New permissions need a stated reason.
- **New dependency** in the diff: what does it pull in, is it maintained, does it need install scripts
  (`.npmrc` disables them repo-wide — a package that needs them is a decision, not a detail), and is it
  SDK-compatible (native deps come from `npx expo install --fix`, not `npm install`).
- **Logging**: `logger.error(message, error, context)` — never a raw error object carrying a full request,
  a token, or PII.

## 4. Bug hunt — run the algorithm, do not browse

For each changed **function**: name its inputs, then walk them.

1. Boundaries from both sides: 0, 1, many; the limit and the limit minus one; empty string versus
   `undefined` versus `null`. `noUncheckedIndexedAccess` is on, so any index access is `T | undefined` —
   check the diff actually handles that rather than asserting it away.
2. Every early return and every `catch` — is the error path correct, or does it swallow and continue with a
   half-built value?
3. Ordering and concurrency: what if it is called twice before the first finishes? What if the second
   call's response arrives first?
4. Idempotency: called twice with the same input, does it do the work twice?

For each changed **component**: mount, unmount, remount. Props changing identity but not value. A
conditional render that changes hook order. A list whose keys are indexes. Both colour schemes if it reads
`useColorScheme()`.

For each changed **async path**: loading → loaded, loading → error, error → retry, and switching the
subject mid-flight (A → B while A is still loading). Stale data rendered under a new identity is the single
most common bug this repo's shape can produce.

For each changed **store**: the pre-hydration state. A `persist`-ed store is empty on first paint;
`useStoreReady` / `_hasHydrated` exists for that. A screen that reads it before hydration shows wrong data
for one frame, or forever if it only reads once.

## 5. Judge the tests

The pre-commit hook only proves a `*.test.*` file exists. You judge whether it is worth anything.

- **Mutation check**: for each test covering this change, would it still pass if the change were reverted?
  Name every test that would. Those are not coverage.
- Assertions that cannot fail: `toBeTruthy()` on a value the test constructed, a `waitFor` whose body
  cannot throw, asserting on English copy where the `react-i18next` mock returns the key.
- **Un-awaited RNTL calls** — `render`, `fireEvent`, `act`, `unmount` are async in RNTL 14. A missing
  `await` is a flake that will surface in an unrelated spec.
- Mock duplication: an inline mock of something `src/test/setup.ts` already provides.
- Missing level: a component used in more than one place, or wired by a screen, covered only by unit tests.

## 6. Accessibility and performance

- `accessibilityLabel` on every icon-only control; `accessibilityRole` matching what the element does;
  `accessibilityState` for selected / disabled / checked. A `Text` inside a `Pressable` is not a label.
- Touch targets at least 44×44 — check `src/shared/lib/theme/controlSizes.ts` rather than eyeballing a
  padding value.
- `Pressable` with `disabled` must also communicate it (`accessibilityState.disabled`), not just stop
  responding.
- Reduced motion resolves to the end state, not to a faster animation.
- A growing list rendered with `.map()` instead of `FlatList`; a `FlatList` with no `keyExtractor`, or with
  fixed-height rows and no `getItemLayout`; an inline `renderItem` closure recreated every render.
- Work on the JS thread inside a gesture or scroll handler that belongs in a worklet.

## 7. Report

Order: **security → leaks → correctness → tests → accessibility → performance.** Style is not a finding.

Flag unrequested work the moment you see it, not in the summary.

Per finding: `path/to/file.ts:LINE`, one sentence on what is wrong, and the concrete input or sequence that
breaks it. If you cannot make it concrete, label it `suspicion` and say what you would need to confirm it.
Do not pad the list — three real findings beat twelve observations.

Say whether the diff is OTA-safe or needs a native rebuild; shipping a native-config change over the air
is a silent no-op.

End with `Confidence: HIGH | MEDIUM | LOW — reason`.
