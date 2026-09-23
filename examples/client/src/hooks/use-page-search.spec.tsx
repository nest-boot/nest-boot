// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import z from "zod";
import { usePageSearch } from "./use-page-search";
import type { ReactNode } from "react";
import { CurrentUserProvider } from "@/app/_authenticated/contexts/current-user-context";

const searchSchema = z.object({
  query: z.string().default(""),
  first: z.number().int().min(1).default(20),
});
let userId = "alice";
let sequence = 0;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <CurrentUserProvider
        value={{
          id: userId,
          name: userId,
          email: `${userId}@example.com`,
          permissions: [],
        }}
      >
        {children}
      </CurrentUserProvider>
    </StrictMode>
  );
}
function key() {
  return ["test", ++sequence] as const;
}
function storageKey(pageKey: ReadonlyArray<string | number>) {
  return `page-search:v1:${JSON.stringify([userId, ...pageKey])}`;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  userId = "alice";
});

describe("usePageSearch", () => {
  it("only writes explicitly, synchronizes equal keys, and persists across remounts", () => {
    const pageKey = key();
    const reader = renderHook(
      () => usePageSearch({ key: [...pageKey], searchSchema }),
      { wrapper },
    );
    expect(reader.result.current.pageSearch).toBeUndefined();
    const writer = renderHook(
      () => usePageSearch({ key: [...pageKey], searchSchema }),
      { wrapper },
    );
    expect(sessionStorage.getItem(storageKey(pageKey))).toBeNull();
    act(() =>
      writer.result.current.setPageSearch({ query: "example", first: 5 }),
    );
    expect(reader.result.current.pageSearch).toEqual({
      query: "example",
      first: 5,
    });
    const setter = writer.result.current.setPageSearch;
    writer.rerender();
    expect(writer.result.current.setPageSearch).toBe(setter);
    expect(reader.result.current.pageSearch).toEqual({
      query: "example",
      first: 5,
    });
    writer.unmount();
    reader.unmount();
    const restored = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    expect(restored.result.current.pageSearch).toEqual({
      query: "example",
      first: 5,
    });
    expectTypeOf(restored.result.current.pageSearch).toEqualTypeOf<
      z.output<typeof searchSchema> | undefined
    >();
    act(() => restored.result.current.setPageSearch({}));
    expect(restored.result.current.pageSearch).toEqual({
      query: "",
      first: 20,
    });
    act(() => restored.result.current.setPageSearch(undefined));
    expect(restored.result.current.pageSearch).toBeUndefined();
    expect(sessionStorage.getItem(storageKey(pageKey))).toBeNull();
  });

  it("isolates different page scopes and signed-in users", () => {
    const pageKey = key();
    const writer = renderHook(
      () =>
        usePageSearch({
          key: [...pageKey, "workspace-one"],
          searchSchema,
        }),
      { wrapper },
    );
    act(() => writer.result.current.setPageSearch({ query: "private" }));
    const reader = renderHook(
      () => usePageSearch({ key: [...pageKey, "workspace-two"], searchSchema }),
      { wrapper },
    );
    expect(reader.result.current.pageSearch).toBeUndefined();
    const scoped = renderHook(
      () => usePageSearch({ key: [...pageKey, "workspace-one"], searchSchema }),
      { wrapper },
    );
    expect(scoped.result.current.pageSearch?.query).toBe("private");
    userId = "bob";
    scoped.rerender();
    expect(scoped.result.current.pageSearch).toBeUndefined();
    act(() => scoped.result.current.setPageSearch({ query: "bob only" }));
    userId = "alice";
    scoped.rerender();
    expect(scoped.result.current.pageSearch?.query).toBe("private");
  });

  it.each(["not json", "null", "[]", '{"first":-1}', '{"query":{}}'])(
    "discards invalid stored search: %s",
    (raw) => {
      const pageKey = key();
      sessionStorage.setItem(storageKey(pageKey), raw);
      sessionStorage.setItem("unrelated", "keep");
      const { result } = renderHook(
        () => usePageSearch({ key: pageKey, searchSchema }),
        { wrapper },
      );
      expect(result.current.pageSearch).toBeUndefined();
      expect(sessionStorage.getItem(storageKey(pageKey))).toBeNull();
      expect(sessionStorage.getItem("unrelated")).toBe("keep");
    },
  );

  it("validates reads, strips unknown fields and observes storage events", () => {
    const pageKey = key();
    sessionStorage.setItem(
      storageKey(pageKey),
      JSON.stringify({ query: "example", secret: "not search" }),
    );
    const { result } = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    expect(result.current.pageSearch).toEqual({ query: "example", first: 20 });
    act(() => {
      sessionStorage.setItem(
        storageKey(pageKey),
        JSON.stringify({ query: "updated" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: storageKey(pageKey) }),
      );
    });
    expect(result.current.pageSearch?.query).toBe("updated");
  });

  it.each(["getItem", "setItem"] as const)(
    "falls back to synchronized memory when %s is unavailable",
    (method) => {
      const pageKey = key();
      vi.spyOn(
        Object.getPrototypeOf(sessionStorage) as Storage,
        method,
      ).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      const reader = renderHook(
        () => usePageSearch({ key: pageKey, searchSchema }),
        { wrapper },
      );
      const writer = renderHook(
        () =>
          usePageSearch({
            key: pageKey,
            searchSchema,
          }),
        { wrapper },
      );
      act(() => writer.result.current.setPageSearch({ query: "fallback" }));
      expect(reader.result.current.pageSearch?.query).toBe("fallback");
    },
  );

  it("applies functional updates to the latest shared value, including before rerender", () => {
    const pageKey = key();
    const first = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    const second = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    act(() => {
      first.result.current.setPageSearch((previous) => ({
        query: previous?.query ?? "initial",
        first: 5,
      }));
      second.result.current.setPageSearch((previous) => ({
        ...previous,
        first: previous!.first + 1,
      }));
      first.result.current.setPageSearch((previous) => ({
        ...previous,
        first: previous!.first + 1,
      }));
    });
    expect(first.result.current.pageSearch).toEqual({
      query: "initial",
      first: 7,
    });
    expect(second.result.current.pageSearch).toEqual(
      first.result.current.pageSearch,
    );
  });

  it("validates writes without replacing valid search on failure and avoids duplicate writes", () => {
    const pageKey = key();
    const { result } = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    const setItem = vi.spyOn(
      Object.getPrototypeOf(sessionStorage) as Storage,
      "setItem",
    );
    const input = { query: "saved", secret: "must not persist" };
    act(() => result.current.setPageSearch(input));
    expect(JSON.parse(sessionStorage.getItem(storageKey(pageKey))!)).toEqual({
      query: "saved",
      first: 20,
    });
    act(() => result.current.setPageSearch({ query: "saved", first: 20 }));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(() => result.current.setPageSearch({ first: 0 })).toThrow();
    expect(() => result.current.setPageSearch(() => ({ first: 0 }))).toThrow();
    expect(result.current.pageSearch).toEqual({ query: "saved", first: 20 });
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("switches the setter's workspace key without modifying the previous scope", () => {
    const pageKey = key();
    const { result, rerender } = renderHook(
      ({ workspace }) =>
        usePageSearch({ key: [...pageKey, workspace], searchSchema }),
      { wrapper, initialProps: { workspace: "one" } },
    );
    act(() => result.current.setPageSearch({ query: "one" }));
    rerender({ workspace: "two" });
    expect(result.current.pageSearch).toBeUndefined();
    act(() => result.current.setPageSearch({ query: "two" }));
    rerender({ workspace: "one" });
    expect(result.current.pageSearch?.query).toBe("one");
  });
});
