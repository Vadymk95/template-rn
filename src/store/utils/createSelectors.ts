import type { StoreApi, UseBoundStore } from 'zustand';

type WithSelectors<S> = S extends { getState: () => infer T }
    ? S & { use: { [K in keyof T]: () => T[K] } }
    : never;

// Auto-generates `store.use.field()` hooks for every slice of state.
// Usage: `const name = useUserStore.use.name()` instead of `useUserStore((s) => s.name)`.
export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(store: S) => {
    const withSelectors = store as WithSelectors<typeof store>;
    withSelectors.use = {} as WithSelectors<typeof store>['use'];
    for (const key of Object.keys(store.getState()) as (keyof ReturnType<S['getState']>)[]) {
        (withSelectors.use as Record<string, unknown>)[key as string] = () =>
            store((state) => state[key as keyof typeof state]);
    }
    return withSelectors;
};
