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
  it("synchronizes equal keys, persists across remounts, and only writes when search is provided", () => {
    const pageKey = key();
    const reader = renderHook(
      () => usePageSearch({ key: [...pageKey], searchSchema }),
      { wrapper },
    );
    expect(reader.result.current.search).toBeUndefined();
    const initialProps: { search?: z.input<typeof searchSchema> } = {
      search: { query: "example", first: 5 },
    };
    const writer = renderHook(
      ({ search }: { search?: z.input<typeof searchSchema> }) =>
        usePageSearch({ key: [...pageKey], searchSchema, search }),
      { wrapper, initialProps },
    );
    expect(reader.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    writer.rerender({});
    expect(reader.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    writer.unmount();
    reader.unmount();
    const restored = renderHook(
      () => usePageSearch({ key: pageKey, searchSchema }),
      { wrapper },
    );
    expect(restored.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    expectTypeOf(restored.result.current.search).toEqualTypeOf<
      z.output<typeof searchSchema> | undefined
    >();
    renderHook(
      () => usePageSearch({ key: pageKey, searchSchema, search: {} }),
      {
        wrapper,
      },
    );
    expect(restored.result.current.search).toEqual({ query: "", first: 20 });
  });

  it("isolates different page scopes and signed-in users", () => {
    const pageKey = key();
    renderHook(
      () =>
        usePageSearch({
          key: [...pageKey, "workspace-one"],
          searchSchema,
          search: { query: "private" },
        }),
      { wrapper },
    );
    const reader = renderHook(
      () => usePageSearch({ key: [...pageKey, "workspace-two"], searchSchema }),
      { wrapper },
    );
    expect(reader.result.current.search).toBeUndefined();
    const scoped = renderHook(
      () => usePageSearch({ key: [...pageKey, "workspace-one"], searchSchema }),
      { wrapper },
    );
    expect(scoped.result.current.search?.query).toBe("private");
    userId = "bob";
    scoped.rerender();
    expect(scoped.result.current.search).toBeUndefined();
    userId = "alice";
    scoped.rerender();
    expect(scoped.result.current.search?.query).toBe("private");
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
      expect(result.current.search).toBeUndefined();
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
    expect(result.current.search).toEqual({ query: "example", first: 20 });
    act(() => {
      sessionStorage.setItem(
        storageKey(pageKey),
        JSON.stringify({ query: "updated" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: storageKey(pageKey) }),
      );
    });
    expect(result.current.search?.query).toBe("updated");
  });

  it.each(["getItem", "setItem"] as const)(
    "falls back to synchronized memory when %s is unavailable",
    (method) => {
      const pageKey = key();
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      const reader = renderHook(
        () => usePageSearch({ key: pageKey, searchSchema }),
        { wrapper },
      );
      renderHook(
        () =>
          usePageSearch({
            key: pageKey,
            searchSchema,
            search: { query: "fallback" },
          }),
        { wrapper },
      );
      expect(reader.result.current.search?.query).toBe("fallback");
    },
  );
});
