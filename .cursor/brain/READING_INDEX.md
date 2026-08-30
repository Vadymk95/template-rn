# Reading index — what to open, by SITUATION

Two maps already exist and this is neither. `AGENTS.md` says what the RULES are; `MAP.md` says what
each file IS. Neither answers "I am about to do X — what do I open first", which is this file's only
job: the trigger, not the content. **It points and never restates** — a line summarising a doc rots
the moment that doc changes; a line naming the doc and its section does not. Where two files could
answer, the entry says which one WINS.

Why it exists, measured on a sibling project (2026-08-30): an agent's entry is dominated by READING
SOURCE to find out where things are — roughly 93% of a lane's spend before it writes anything, while
the auto-loaded docs are ~7%. The lever is precision of pointing, not smaller documents. The single
biggest observed difference between a 33-tool lane and a 191-tool lane was how exactly the task
named its files.

## 1. Picking this repo up cold

- `AGENTS.md` — WINS: the operating contract, the critical rules, the tier law (§ Commands / the gate).
- `.cursor/brain/PROJECT_CONTEXT.md` — stack, SDK pins, what CI runs.
- `.cursor/brain/MAP.md` — the file map; read it INSTEAD of sweeping `src/`.

## 2. About to change a screen or a component

- `.cursor/rules/react-patterns.mdc` + `AGENTS.md` § Critical rules — WINS: arrow-only components,
  explicit return types, `className` only (no StyleSheet), logic extracted to `useComponentName`.
- `.cursor/brain/SKELETONS.md` — the danger zones a screen edit tends to hit.
- `src/test/contentStress.ts` — add a case when the component renders authored copy; the native axes
  are line count, a shrinking text sibling and the OS font scale, not `overflow-wrap`.

## 3. About to change navigation or a route

- `AGENTS.md` § Critical rules "Expo Router" — WINS: file-based routing, route groups, typed routes.
- `.cursor/brain/MAP.md` — which screen file backs which route.

## 4. About to touch native config, permissions or the build

- `AGENTS.md` § Critical rules "CNG" — WINS: `app.config.ts` is the source of truth and `ios/` /
  `android/` are generated; never hand-edit them.
- `.cursor/brain/VERIFICATION.md` "Native / machine parity" and "Before first EAS build" — what to run
  and in which order.
- `.cursor/brain/DECISIONS.md` — the SDK pins and why bumping past `expo install --fix` breaks things.

## 5. About to touch a gate, a hook, or CI

- `AGENTS.md` § Commands / the gate — WINS: the tier law itself (what runs at which moment, the
  prohibitions).
- `.cursor/brain/VERIFICATION.md` — the mechanics: the per-change table, the hooks, the tracer.
- `scripts/gate-tiers.json` — the moments and budgets as DATA, plus the measured reason this repo has
  no scaffold phase.

## 6. About to add a dependency, or an advisory went red

- `AGENTS.md` § Version holds — WINS: native packages come from `expo install --fix`, never
  `npm outdated`; floors carry a major cap; the `image-size` advisories are allowlisted because no
  fixed release exists.
- `scripts/audit-allowlist.json` — the current allowances and their expiry.

## 7. Wondering whether the work is still needed

Before reading anything else: `git log --oneline -15`, then grep for the thing the task names. On the
sibling project two of five dispatched lanes returned "already done" after ~430k tokens between them,
and both were answerable by five minutes of grep. **This entry is first in cost order even though it
is last in the list.**

## What this repo cannot give you, and the honest substitute

The web siblings ship `npm run probe`, which renders a route at several widths and saves a PNG, so an
agent can LOOK instead of inferring. **There is no equivalent here and that is a platform fact, not an
omission:** RNTL renders to a tree with no layout engine, so nothing in the test stack can measure a
pixel. The substitutes, in order of cost: assert the PROPS that bound a layout
(`numberOfLines`, `maxFontSizeMultiplier`, a shrinking sibling) as `AGENTS.md` describes; then a
Maestro flow under `.maestro/`; then a real device. Do not invent a jsdom-style measurement — it would
be a check that cannot fail.

## Keeping this honest

Add a situation only after an agent was actually sent to the wrong file over it. When two files could
answer, name which one WINS — never list both and leave the reader to guess.
