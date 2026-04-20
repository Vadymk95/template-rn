> **Pattern reference — UI primitive + feature-slice split.** Realized in commit `c9fcba6`; kept as a worked example of how `shared/ui/*` primitives and `features/*` slices divide responsibilities for a new domain.

# Showcase Todo Template Design

## Goal

Replace the current starter experience with a production-minded, local-only Todo
workspace that demonstrates how to build an MVP in this Expo / React Native
template. The example must feel polished and reusable, while still being easy to
remove or replace when a real product is initialized from the template.

## Why This Exists

The template should not open on an empty or toy-looking screen. It should show:

- a realistic mobile CRUD flow
- a clean boundary between app composition, entities, features, widgets, and
  shared UI
- a reusable foundation for buttons, inputs, cards, empty states, layout, and
  modal patterns
- a neutral theme/token system without magic strings or magic numbers in screen
  code
- a clear path for future agents to replace the example slice with real product
  slices

This example is intentionally **local-only**. It uses mock data and local state,
but is structured so that an API-backed MVP can replace the data layer later
without rewriting the whole screen architecture.

## Product Shape

The first tab becomes the main **Todo workspace** and replaces the simplistic
starter surface.

The workspace includes:

- a top screen header with title, short supporting copy, and a primary action
- a summary row with counts such as total, active, and completed
- a filter row for showing all, active, or completed tasks
- a task list with realistic item actions
- an empty state when filters produce no visible tasks
- a center modal for create and edit flows

The result should look like a neutral template rather than a branded demo. It
must feel closer to a real product starting point than to a tutorial app.

## Scope

### In Scope

- Replace the main starter experience with a Todo workspace
- Implement full local CRUD:
    - create task
    - read/list tasks
    - edit task
    - toggle completion
    - delete task
- Add a reusable UI foundation in `shared/ui`
- Add theme/tokens for spacing, typography, radii, semantic colors, and
  interaction states
- Add a reset guide in docs describing what to keep and what to replace
- Keep the implementation local-only, with mock data and local state

### Out of Scope

- Real backend or query client integration for todos
- Offline sync, pagination, or networking abstractions
- A large UI kit beyond what this slice proves necessary
- A dedicated showroom or component gallery as the main app surface
- Product branding, heavy illustration, or decorative marketing-style UI

## Architecture

The architecture must reinforce the repo's intended direction:

- `src/app/` handles route composition only
- `src/widgets/` composes screen sections from features and entities
- `src/features/` holds focused user actions
- `src/entities/` holds todo domain state and pure domain helpers
- `src/shared/ui/` holds reusable presentational primitives
- `src/shared/lib/theme/` or `src/shared/theme/` holds tokens and semantic theme
  helpers

This keeps the example slice readable for new React Native developers while also
showing future agents where new code belongs.

## Proposed File Structure

The exact file names can shift slightly to match existing repo conventions, but
the implementation should follow this shape:

```text
src/
  app/
    (tabs)/
      index.tsx                  # route file only, renders widget/screen entry
  entities/
    todo/
      model/
        constants.ts
        selectors.ts
        types.ts
      store/
        todoStore.ts
        todoStore.test.ts
      lib/
        createTodoId.ts
        filterTodos.ts
        sortTodos.ts
      api/
        mockTodos.ts             # local seed data only
  features/
    todo-create/
      TodoCreateDialog.tsx
      TodoForm.tsx
    todo-edit/
      TodoEditDialog.tsx
    todo-filter/
      TodoFilterBar.tsx
    todo-toggle/
      TodoToggleButton.tsx
    todo-delete/
      TodoDeleteButton.tsx
  widgets/
    todo-workspace/
      TodoWorkspaceScreen.tsx
      TodoSummaryCards.tsx
      TodoList.tsx
      TodoListItem.tsx
      TodoEmptyState.tsx
  shared/
    ui/
      screen/
      screen-header/
      button/
      icon-button/
      input/
      card/
      section-header/
      empty-state/
      filter-chip/
      dialog/
    lib/
      constants/
        ...
      theme/
        tokens.ts
        colors.ts
        spacing.ts
        radii.ts
        typography.ts
        controlSizes.ts
```

The exact folder count should stay minimal. If a subfolder would exist only to
wrap one tiny file, keep the structure flatter.

## Reusable UI Foundation

The slice should justify and exercise a small set of reusable primitives.

### `Screen`

Responsibilities:

- safe area awareness
- content width/padding policy
- optional scroll behavior
- consistent page background

This becomes the default page shell for feature screens in the template.

### `ScreenHeader`

Responsibilities:

- title
- optional subtitle/supporting copy
- optional right action

This should work for the Todo workspace and future product screens.

### `Button`

Must be built on `Pressable`, not `TouchableOpacity`.

Why:

- modern React Native interaction primitive
- supports pressed/focus/hover style decisions more directly
- better foundation for reusable controls
- aligns with current RN docs and strong starter repos

Supported props should stay intentional:

- `variant`: `primary | secondary | ghost | destructive`
- `size`: `sm | md | lg`
- `fullWidth`
- `loading`
- `disabled`
- `leftSlot`
- `rightSlot`
- `accessibilityLabel` passthrough

States:

- default
- pressed
- disabled
- loading
- hover where supported
- focus-visible where supported

The visual language should be restrained and neutral, not flashy.

### `IconButton`

Responsibilities:

- small icon-only action surface
- consistent hit slop / touch target
- semantic variants for neutral vs destructive actions

### `Input`

Responsibilities:

- label
- hint
- error
- placeholder
- optional leading/trailing accessory

The first version can stay single-line if that keeps the slice focused. If a
second field is introduced for notes/description, the input pattern may expand.

### `Card`

Responsibilities:

- surface container
- semantic padding and border treatment
- subtle elevation / contrast policy

### `SectionHeader`

Responsibilities:

- section title
- optional supportive text
- optional inline action

### `EmptyState`

Responsibilities:

- empty title
- empty description
- action button

### `FilterChip`

Responsibilities:

- selectable filter pills for `All`, `Active`, `Completed`
- selected/unselected/disabled states

### `Dialog`

The reusable modal primitive for the template.

Pattern chosen:

- **center modal**

Why:

- easier for a first React Native project
- closer to web mental models
- still appropriate for mobile when sized correctly
- easier to reuse for confirmations and simple edit forms

Responsibilities:

- backdrop
- content shell
- title / description slots
- close behavior
- action footer support
- keyboard-safe layout

## Todo Domain Model

The Todo entity stays intentionally small but realistic.

Suggested fields:

- `id`
- `title`
- `completed`
- `createdAt`
- `updatedAt`

Optional fields should be added only if the screen truly needs them. Do not add
priority, due dates, tags, or notes unless they materially improve the example.
For the first version, `title` plus timestamps is likely enough.

Use named constants for all filter identifiers and user-visible display logic.

## State Management

Because this is a local-only template example, use a focused local store for the
todo entity rather than introducing a fake API layer.

The store should expose clear actions:

- `createTodo`
- `updateTodo`
- `toggleTodo`
- `deleteTodo`
- `setFilter`

Keep selectors or derived helpers pure and separate where practical. The goal is
to demonstrate a clean local-domain structure, not to simulate network state.

## CRUD Flow

### Create

- Primary action in the header opens the center dialog
- User enters title and submits
- New task appears in the list immediately

### Read

- Main list renders current filtered tasks
- Empty state appears when no tasks match the selected filter

### Update

- Toggle completion directly from the list
- Edit action opens the same dialog in edit mode

### Delete

- Delete action available from the list item or from edit mode
- The destructive action must look clearly different from neutral actions

## Interaction and Accessibility

The example should teach good habits:

- no undersized tap targets
- state communicated visually and semantically
- correct `accessibilityRole`
- disabled states are visually distinct and behaviorally inert
- icon-only actions require labels
- buttons and chips react to pressed state consistently

Hover is a progressive enhancement, not a required core interaction. The UI must
still feel complete on touch-only devices.

## Theme and Tokens

No screen-level magic numbers for spacing, radii, control heights, icon sizes,
or color roles.

Create a small token layer with:

- semantic colors:
    - `background`
    - `surface`
    - `surfaceMuted`
    - `border`
    - `textPrimary`
    - `textSecondary`
    - `accent`
    - `success`
    - `danger`
- spacing scale
- radius scale
- control heights
- icon size scale
- typography roles
- pressed/disabled state values

The Todo workspace should consume these tokens instead of inline values.

## Styling Direction

The styling target is:

- neutral
- calm
- structured
- modern enough to feel intentional
- not over-branded

The screen should look clean on first open, with spacing closer to mature mobile
apps than to tutorial examples. Cards, controls, and headers should follow one
rhythm and one hierarchy.

## Magic Strings and Copy

Avoid magic strings in business or view logic:

- filter ids should be constants
- action identifiers should be constants
- static labels should be routed through the repo's localization approach where
  it makes sense for persistent UI copy

Do not force a full i18n expansion if that meaningfully slows the first slice,
but avoid scattering ad-hoc labels across multiple files.

## Route Composition

`src/app/(tabs)/index.tsx` should remain thin. The route file should render the
workspace widget or screen entry rather than contain domain logic.

This is important because the template is meant to teach route composition, not
encourage large route files.

## Documentation: Template Reset Guide

Add `docs/template-reset.md`.

It should explain:

### Keep

- `app.config.ts`
- build and perf scripts
- shared theme/tokens
- shared UI primitives
- router shell and providers
- general infra and quality gates

### Replace First

- todo entity state
- todo features/widgets
- starter copy
- mock todo data

### Suggested Replacement Order

1. Replace the main route's screen composition with the product's first slice
2. Remove todo entity/features/widgets
3. Replace starter copy and icons if needed
4. Keep growing from the foundation primitives and theme tokens

### How to Grow Into a Real MVP

- replace local todo store with API-backed data
- introduce DTOs/mappers only when real transport exists
- keep route files thin
- keep reusable UI in `shared/ui`
- add new features as slices, not as giant screens

## Testing Expectations

Because this changes behavior and introduces a new slice, tests should cover:

- todo store actions
- at least one interaction test for the modal form flow
- at least one interaction test for filter or toggle behavior
- targeted tests for reusable logic when it is pure and non-trivial

Avoid snapshot-heavy tests. Prefer behavior that proves the slice works.

## Verification Expectations

At implementation time, verification should include:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- local smoke of the main screen and CRUD flow

If the styling or new components affect formatting heavily, include
`npm run format:check`.

## Risks and Mitigations

### Risk: Overbuilding the UI foundation

Mitigation:

- only add primitives that the Todo workspace actually proves

### Risk: Turning the template into a demo app

Mitigation:

- keep copy neutral
- keep the slice replaceable
- document replacement clearly in `template-reset.md`

### Risk: Route files becoming logic containers

Mitigation:

- keep routing thin and move composition into widgets/screens

### Risk: Web habits leaking into touch-first UX

Mitigation:

- treat hover as enhancement only
- design for touch targets and pressed states first

## Acceptance Criteria

The design is successful if:

- the first screen feels like a credible MVP starter, not a toy
- the codebase clearly demonstrates where shared UI, entities, features, and
  widgets belong
- the slice supports complete local CRUD through a reusable center modal
- buttons and interactive controls are built on `Pressable`
- styling uses theme/tokens rather than ad-hoc values
- future agents can understand what to keep vs replace by reading
  `docs/template-reset.md`
