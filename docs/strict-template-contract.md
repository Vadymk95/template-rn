# Strict template contract

This template is intentionally strict. Structure, copy placement, tests, and
verification are part of the product contract of the template itself.

## Read order for agents

Before non-trivial work:

1. `.cursor/brain/PROJECT_CONTEXT.md`
2. `.cursor/brain/MAP.md`
3. `.cursor/brain/VERIFICATION.md`
4. `.cursor/rules/fsd-layers.mdc` when imports or new `src/` paths change
5. `.cursor/brain/SKELETONS.md` when touching native config, stores, env, Metro/Babel, router layouts

## Architecture law

- Layer order is fixed: `app -> widgets -> features -> entities -> shared`
- `src/app/**` stays thin: routes and provider wiring only
- Widgets compose features, not stores
- Zustand client state belongs in `src/store/**`
- Reusable primitives and infra belong in `src/shared/**` or `src/lib/**`
- `@/` imports only inside `src/**`

The blocking source of truth is `eslint.config.mjs` + `eslint-plugin-boundaries`,
not tribal knowledge.

## Copy, constants, and tokens

- User-visible copy belongs in `src/shared/locales/**`
- UI reads that copy through `useTranslation` / `t()`
- Feature `constants.ts` files are for ids, key maps, and derived helpers
- Tokens / reusable variants / spacing / radii belong in theme or scoped constants, not scattered literals

If a string would matter to a user, a translator, a designer, or a future
agent, it should not be a random inline English literal.

## Quality gates

- Typical local code-edit loop: `npm run typecheck && npm run lint && npm run test`
- Repo-wide blocking contract: `npm run verify`
- Native / machine parity: `npm run ci:local`
- CI must stay aligned with the declared contract in `.cursor/brain/VERIFICATION.md`
- Repo-owned lint rules live in `tooling/eslint-plugin-template/` and are part of the contract, not optional extras

Do not weaken local and CI behavior silently. If a gate changes, update the
verification doc and README in the same change.

## Testing policy

- Stores, pure utilities, and non-trivial hooks follow TDD-first
- UI uses behavior-level integration tests
- Copy moves, routing changes, validation changes, and accessibility changes must
  leave at least one test proving the visible contract still works

## Definition of done

A change is not done until:

1. structure still matches the layer contract
2. user copy is in the right place
3. lint, typecheck, formatting, and tests pass for the intended scope
4. repo-wide `npm run verify` passes before merge-worthy completion
5. docs / brain files are updated if the architectural contract changed

## After a fork

When the template is adopted into a product, update this file, the verification
matrix, and the agent rules together. The template should teach one coherent way
to work, not several competing ones.
