import { useSyncExternalStore } from 'react';

import { storage } from './storage';

/**
 * A small persisted store: state kept in memory for rendering, saved to the device on every change, and read
 * by components through `useStore`, which re-renders them when it changes. Used for settings and review data.
 */
export function createStore<T extends object>(key: string, initial: T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());

  return {
    get: () => state,
    get loaded() {
      return loaded;
    },
    async load() {
      state = { ...initial, ...(await storage.get<Partial<T>>(key, {})) };
      loaded = true;
      emit();
    },
    set(change: Partial<T> | ((current: T) => Partial<T>)) {
      state = { ...state, ...(typeof change === 'function' ? change(state) : change) };
      emit();
      void storage.set(key, state);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Store<T extends object> = ReturnType<typeof createStore<T>>;

export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
