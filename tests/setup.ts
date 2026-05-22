import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

const createStorageMock = () => {
  const store = new Map<string, string>();

  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    get length() {
      return store.size;
    },
  };
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createStorageMock(),
});

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: createStorageMock(),
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
