import type { StoreApi, UseBoundStore } from 'zustand';

type WithSelectors<T extends object> = UseBoundStore<StoreApi<T>> & {
    use: { [K in keyof T]: () => T[K] };
};

// Auto-generates `store.use.field()` hooks for every slice of state.
// Usage: `const name = useUserStore.use.name()` instead of `useUserStore((s) => s.name)`.
export const createSelectors = <T extends object>(
    store: UseBoundStore<StoreApi<T>>
): WithSelectors<T> => {
    const withSelectors = store as WithSelectors<T>;
    withSelectors.use = {} as WithSelectors<T>['use'];
    for (const key of Object.keys(store.getState()) as (keyof T)[]) {
        (withSelectors.use as Record<string, unknown>)[key as string] = () =>
            store((state) => state[key]);
    }
    return withSelectors;
};
