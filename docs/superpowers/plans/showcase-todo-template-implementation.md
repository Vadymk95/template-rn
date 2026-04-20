# Showcase Todo Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the starter home tab with a polished local-only Todo CRUD workspace that demonstrates the template's intended architecture, reusable UI primitives, theme tokens, and replacement path for future MVP work.

**Architecture:** Keep Expo Router route files thin, place domain state under `src/store/` to respect this repo's FSD contract, build reusable primitives in `src/shared/ui/`, compose the main screen from `src/widgets/`, and document the replace-first scaffold boundaries in `docs/template-reset.md`. Use `Pressable`-based controls, local mock data, and a reusable center dialog for create/edit flows.

**Tech Stack:** Expo SDK 55, React Native 0.83, Expo Router, NativeWind 4, TypeScript strict, Zustand, Jest + Testing Library React Native, i18next.

---

### Task 1: Add Todo Domain State and Pure Helpers

**Files:**

- Create: `src/store/todo/constants.ts`
- Create: `src/store/todo/types.ts`
- Create: `src/store/todo/mockTodos.ts`
- Create: `src/store/todo/filterTodos.ts`
- Create: `src/store/todo/createTodoId.ts`
- Create: `src/store/todo/todoStore.ts`
- Create: `src/store/todo/todoStore.test.ts`
- Reference: `src/store/user/userStore.ts`
- Reference: `src/store/user/userStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `src/store/todo/todoStore.test.ts` with behavior-first coverage for create, update, toggle, delete, and filter changes:

```ts
import { act, renderHook } from '@testing-library/react-native';

import { DEFAULT_TODO_FILTER, TODO_FILTER, TODO_TITLE_MAX_LENGTH } from '@/store/todo/constants';
import { useTodoStore } from '@/store/todo/todoStore';

describe('useTodoStore', () => {
    beforeEach(() => {
        useTodoStore.setState(useTodoStore.getInitialState(), true);
    });

    it('creates a new todo with trimmed title and default incomplete state', () => {
        const { result } = renderHook(() => useTodoStore());

        act(() => {
            result.current.createTodo('  Ship Expo template  ');
        });

        const created = result.current.todos.at(0);

        expect(created?.title).toBe('Ship Expo template');
        expect(created?.completed).toBe(false);
        expect(result.current.todos).toHaveLength(4);
    });

    it('updates an existing todo title and refreshes updatedAt', () => {
        const { result } = renderHook(() => useTodoStore());
        const target = result.current.todos[0];

        act(() => {
            result.current.updateTodo(target.id, 'Refine starter experience');
        });

        const updated = result.current.todos.find((todo) => todo.id === target.id);

        expect(updated?.title).toBe('Refine starter experience');
        expect(updated?.updatedAt).not.toBe(target.updatedAt);
    });

    it('toggles a todo completion flag', () => {
        const { result } = renderHook(() => useTodoStore());
        const target = result.current.todos[0];

        act(() => {
            result.current.toggleTodo(target.id);
        });

        expect(result.current.todos.find((todo) => todo.id === target.id)?.completed).toBe(true);
    });

    it('deletes a todo by id', () => {
        const { result } = renderHook(() => useTodoStore());
        const target = result.current.todos[0];

        act(() => {
            result.current.deleteTodo(target.id);
        });

        expect(result.current.todos.find((todo) => todo.id === target.id)).toBeUndefined();
        expect(result.current.todos).toHaveLength(2);
    });

    it('changes the active filter', () => {
        const { result } = renderHook(() => useTodoStore());

        act(() => {
            result.current.setFilter(TODO_FILTER.completed);
        });

        expect(result.current.filter).toBe(TODO_FILTER.completed);
    });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `npm run test -- src/store/todo/todoStore.test.ts`

Expected: FAIL because the todo store files do not exist yet.

- [ ] **Step 3: Implement minimal todo constants, types, helpers, and store**

Create the constants and store with a small realistic model:

```ts
// src/store/todo/constants.ts
export const TODO_FILTER = {
    all: 'all',
    active: 'active',
    completed: 'completed'
} as const;

export const DEFAULT_TODO_FILTER = TODO_FILTER.all;
export const TODO_TITLE_MAX_LENGTH = 120 as const;
```

```ts
// src/store/todo/types.ts
import { TODO_FILTER } from './constants';

export type TodoFilter = (typeof TODO_FILTER)[keyof typeof TODO_FILTER];

export interface TodoItem {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TodoStoreState {
    todos: TodoItem[];
    filter: TodoFilter;
    createTodo: (title: string) => void;
    updateTodo: (id: string, title: string) => void;
    toggleTodo: (id: string) => void;
    deleteTodo: (id: string) => void;
    setFilter: (filter: TodoFilter) => void;
}
```

```ts
// src/store/todo/todoStore.ts
import { create } from 'zustand';

import { DEFAULT_TODO_FILTER } from '@/store/todo/constants';
import { createTodoId } from '@/store/todo/createTodoId';
import { mockTodos } from '@/store/todo/mockTodos';
import type { TodoItem, TodoStoreState } from '@/store/todo/types';

const createInitialState = (): Pick<TodoStoreState, 'todos' | 'filter'> => ({
    todos: mockTodos,
    filter: DEFAULT_TODO_FILTER
});

const updateTodoList = (
    todos: TodoItem[],
    id: string,
    updater: (todo: TodoItem) => TodoItem
): TodoItem[] => todos.map((todo) => (todo.id === id ? updater(todo) : todo));

export const useTodoStore = create<TodoStoreState>((set) => ({
    ...createInitialState(),
    createTodo: (title) =>
        set((state) => {
            const now = new Date().toISOString();
            const trimmedTitle = title.trim();

            return trimmedTitle
                ? {
                      todos: [
                          {
                              id: createTodoId(),
                              title: trimmedTitle,
                              completed: false,
                              createdAt: now,
                              updatedAt: now
                          },
                          ...state.todos
                      ]
                  }
                : state;
        }),
    updateTodo: (id, title) =>
        set((state) => ({
            todos: updateTodoList(state.todos, id, (todo) => ({
                ...todo,
                title: title.trim() || todo.title,
                updatedAt: new Date().toISOString()
            }))
        })),
    toggleTodo: (id) =>
        set((state) => ({
            todos: updateTodoList(state.todos, id, (todo) => ({
                ...todo,
                completed: !todo.completed,
                updatedAt: new Date().toISOString()
            }))
        })),
    deleteTodo: (id) =>
        set((state) => ({
            todos: state.todos.filter((todo) => todo.id !== id)
        })),
    setFilter: (filter) => set({ filter })
}));

useTodoStore.getInitialState = createInitialState;
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npm run test -- src/store/todo/todoStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Run focused static checks for the new domain files**

Run: `npm run typecheck && npm run lint`

Expected: PASS with no FSD boundary violations.

---

### Task 2: Add Theme Tokens and Shared UI Primitives

**Files:**

- Create: `src/shared/lib/theme/colors.ts`
- Create: `src/shared/lib/theme/spacing.ts`
- Create: `src/shared/lib/theme/radii.ts`
- Create: `src/shared/lib/theme/typography.ts`
- Create: `src/shared/lib/theme/controlSizes.ts`
- Create: `src/shared/lib/theme/tokens.ts`
- Create: `src/shared/ui/Button/Button.tsx`
- Create: `src/shared/ui/IconButton/IconButton.tsx`
- Create: `src/shared/ui/Input/Input.tsx`
- Create: `src/shared/ui/Card/Card.tsx`
- Create: `src/shared/ui/SectionHeader/SectionHeader.tsx`
- Create: `src/shared/ui/EmptyState/EmptyState.tsx`
- Create: `src/shared/ui/FilterChip/FilterChip.tsx`
- Create: `src/shared/ui/Screen/Screen.tsx`
- Create: `src/shared/ui/ScreenHeader/ScreenHeader.tsx`
- Create: `src/shared/ui/Dialog/Dialog.tsx`
- Create: `src/shared/ui/Button/Button.test.tsx`

- [ ] **Step 1: Write a failing test for the shared `Button` primitive**

Create `src/shared/ui/Button/Button.test.tsx`:

```ts
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/shared/ui/Button/Button';

describe('Button', () => {
    it('renders the label and calls onPress', () => {
        const onPress = jest.fn();
        const { getByRole, getByText } = render(<Button label="Create task" onPress={onPress} />);

        fireEvent.press(getByRole('button'));

        expect(getByText('Create task')).toBeTruthy();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders children instead of label when custom content is provided', () => {
        const { getByText } = render(
            <Button>
                <Text>Custom content</Text>
            </Button>
        );

        expect(getByText('Custom content')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run the button test to verify it fails**

Run: `npm run test -- src/shared/ui/Button/Button.test.tsx`

Expected: FAIL because the shared button does not exist yet.

- [ ] **Step 3: Add minimal token files and the shared UI primitives**

Keep the token layer small and semantic:

```ts
// src/shared/lib/theme/spacing.ts
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32
} as const;
```

```ts
// src/shared/lib/theme/controlSizes.ts
export const CONTROL_HEIGHT = {
    sm: 36,
    md: 44,
    lg: 52
} as const;
```

```tsx
// src/shared/ui/Button/Button.tsx
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CONTROL_HEIGHT } from '@/shared/lib/theme/controlSizes';

interface ButtonProps {
    label?: string;
    onPress?: () => void;
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
    size?: keyof typeof CONTROL_HEIGHT;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
}

export const Button = ({
    label,
    onPress,
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false
}: ButtonProps): ReactElement => (
    <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPress={onPress}
        className={[
            'items-center justify-center rounded-xl px-4',
            variant === 'primary' && 'bg-foreground',
            variant === 'secondary' && 'bg-muted',
            variant === 'ghost' && 'bg-transparent',
            variant === 'destructive' && 'bg-red-600',
            disabled && 'opacity-50',
            fullWidth ? 'w-full' : 'self-start'
        ]
            .filter(Boolean)
            .join(' ')}
        style={({ pressed }) => ({
            minHeight: CONTROL_HEIGHT[size],
            opacity: pressed && !disabled ? 0.86 : 1
        })}
    >
        {loading ? (
            <ActivityIndicator color={variant === 'ghost' ? '#0a0a0a' : '#ffffff'} />
        ) : children ? (
            <View>{children}</View>
        ) : (
            <Text
                className={[
                    'text-sm font-semibold',
                    variant === 'ghost' ? 'text-foreground' : 'text-background'
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {label}
            </Text>
        )}
    </Pressable>
);
```

Add the remaining primitives with the same philosophy: semantic props, `Pressable`
for interactivity, center-dialog shell, and no ad-hoc layout values in screens.

- [ ] **Step 4: Run the button test to verify the primitive passes**

Run: `npm run test -- src/shared/ui/Button/Button.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run focused static checks for the theme and shared UI layer**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

---

### Task 3: Build the Todo Workspace Widgets and CRUD Dialog Flow

**Files:**

- Create: `src/features/todo-create/TodoForm.tsx`
- Create: `src/features/todo-create/TodoCreateDialog.tsx`
- Create: `src/features/todo-edit/TodoEditDialog.tsx`
- Create: `src/features/todo-filter/TodoFilterBar.tsx`
- Create: `src/features/todo-toggle/TodoToggleButton.tsx`
- Create: `src/features/todo-delete/TodoDeleteButton.tsx`
- Create: `src/widgets/todo-workspace/TodoWorkspaceScreen.tsx`
- Create: `src/widgets/todo-workspace/TodoSummaryCards.tsx`
- Create: `src/widgets/todo-workspace/TodoList.tsx`
- Create: `src/widgets/todo-workspace/TodoListItem.tsx`
- Create: `src/widgets/todo-workspace/TodoEmptyState.tsx`
- Create: `src/widgets/todo-workspace/TodoWorkspaceScreen.test.tsx`

- [ ] **Step 1: Write a failing interaction test for the CRUD workspace**

Create `src/widgets/todo-workspace/TodoWorkspaceScreen.test.tsx`:

```ts
import { fireEvent, render } from '@testing-library/react-native';

import { TodoWorkspaceScreen } from '@/widgets/todo-workspace/TodoWorkspaceScreen';

describe('TodoWorkspaceScreen', () => {
    it('creates a task from the center dialog', () => {
        const { getByText, getByPlaceholderText, queryByText } = render(<TodoWorkspaceScreen />);

        expect(queryByText('Plan MVP analytics')).toBeNull();

        fireEvent.press(getByText('New task'));
        fireEvent.changeText(getByPlaceholderText('What needs to be done?'), 'Plan MVP analytics');
        fireEvent.press(getByText('Create task'));

        expect(getByText('Plan MVP analytics')).toBeTruthy();
    });

    it('filters completed tasks after toggling an item', () => {
        const { getByText, getAllByA11yLabel } = render(<TodoWorkspaceScreen />);

        fireEvent.press(getAllByA11yLabel('Mark task as complete')[0]);
        fireEvent.press(getByText('Completed'));

        expect(getByText('Completed')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run the workspace test to verify it fails**

Run: `npm run test -- src/widgets/todo-workspace/TodoWorkspaceScreen.test.tsx`

Expected: FAIL because the workspace widgets do not exist yet.

- [ ] **Step 3: Implement the features and widget composition**

Keep the route-independent composition in the widget layer:

```tsx
// src/widgets/todo-workspace/TodoWorkspaceScreen.tsx
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { filterTodos } from '@/store/todo/filterTodos';
import { useTodoStore } from '@/store/todo/todoStore';
import { Screen } from '@/shared/ui/Screen/Screen';
import { ScreenHeader } from '@/shared/ui/ScreenHeader/ScreenHeader';
import { TodoFilterBar } from '@/features/todo-filter/TodoFilterBar';
import { TodoCreateDialog } from '@/features/todo-create/TodoCreateDialog';
import { TodoEditDialog } from '@/features/todo-edit/TodoEditDialog';
import { TodoList } from '@/widgets/todo-workspace/TodoList';
import { TodoSummaryCards } from '@/widgets/todo-workspace/TodoSummaryCards';

export const TodoWorkspaceScreen = (): ReactElement => {
    const { todos, filter } = useTodoStore();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);

    const visibleTodos = useMemo(() => filterTodos(todos, filter), [todos, filter]);

    return (
        <Screen scrollable>
            <ScreenHeader
                title="Task workspace"
                subtitle="A local-first example slice for the template foundation."
                actionLabel="New task"
                onActionPress={() => setIsCreateOpen(true)}
            />
            <TodoSummaryCards todos={todos} />
            <TodoFilterBar />
            <TodoList todos={visibleTodos} onEditTodo={setEditingTodoId} />
            <TodoCreateDialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
            <TodoEditDialog todoId={editingTodoId} onClose={() => setEditingTodoId(null)} />
        </Screen>
    );
};
```

Use the `Dialog` primitive for both create and edit flows, a shared `TodoForm`
for title entry, and feature buttons for toggle/delete actions.

- [ ] **Step 4: Run the workspace interaction test to verify it passes**

Run: `npm run test -- src/widgets/todo-workspace/TodoWorkspaceScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run focused static checks for the new feature and widget layers**

Run: `npm run typecheck && npm run lint`

Expected: PASS with boundaries respected: app → widgets → features → store/shared.

---

### Task 4: Wire Routes, Add Copy, and Document Template Reset

**Files:**

- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/shared/locales/en/common.json`
- Modify: `src/shared/locales/en/home.json`
- Create: `docs/template-reset.md`
- Modify: `docs/superpowers/specs/2026-04-20-showcase-todo-template-design.md` (only if implementation decisions require a small clarification)

- [ ] **Step 1: Update route and locale copy with the new workspace wording**

Update the home route to stay thin:

```tsx
// src/app/(tabs)/index.tsx
import type { ReactElement } from 'react';

import { TodoWorkspaceScreen } from '@/widgets/todo-workspace/TodoWorkspaceScreen';

const HomeScreen = (): ReactElement => <TodoWorkspaceScreen />;

export default HomeScreen;
```

Update locale keys so the screen and tabs remain i18n-driven:

```json
// src/shared/locales/en/common.json
{
    "button": {
        "submit": "Submit",
        "cancel": "Cancel",
        "save": "Save",
        "close": "Close",
        "back": "Back",
        "createTask": "Create task",
        "newTask": "New task",
        "deleteTask": "Delete task"
    },
    "tabs": {
        "homeTitle": "Tasks",
        "settingsTitle": "Settings"
    }
}
```

```json
// src/shared/locales/en/home.json
{
    "title": "Task workspace",
    "subtitle": "A production-minded local CRUD slice for the template foundation."
}
```

- [ ] **Step 2: Add the reset guide for future template consumers**

Create `docs/template-reset.md` with a concise guide covering:

```md
# Template Reset Guide

## Keep

- `app.config.ts`
- Expo Router shell and providers
- shared theme tokens
- shared UI primitives
- build, perf, lint, test, and EAS scripts

## Replace First

- `src/store/todo/**`
- `src/features/todo-*`
- `src/widgets/todo-workspace/**`
- starter home copy

## Suggested Order

1. Replace `src/app/(tabs)/index.tsx` composition with the real product's first screen.
2. Remove todo domain/features/widgets.
3. Keep building on `src/shared/ui/**` and `src/shared/lib/theme/**`.
```

- [ ] **Step 3: Run targeted verification for the route and docs wiring**

Run: `npm run typecheck && npm run lint && npm run test`

Expected: PASS.

- [ ] **Step 4: Run full local verification for the implementation branch**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: Perform a manual smoke checklist**

Verify manually:

- home tab opens the Todo workspace
- new task dialog opens and closes correctly
- create/edit/delete/toggle all work
- empty state appears for a filter with no results
- disabled and pressed button states look intentional

---

### Task 5: Final Consistency Pass

**Files:**

- Review: all changed files from Tasks 1-4

- [ ] **Step 1: Re-read the changed files against the spec**

Confirm:

- route files are thin
- store stays under `src/store/`
- widgets do not import `app`
- shared UI does not depend on product-layer code

- [ ] **Step 2: Run final checks**

Run: `npm run typecheck && npm run lint && npm run test && npm run format:check`

Expected: PASS.

- [ ] **Step 3: Prepare a human-readable summary**

Capture:

- what foundation was added
- what slice is replace-first
- where to look first as a newcomer
