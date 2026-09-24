// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import z from "zod";
import { useResourceNavigation } from "./use-resource-navigation";
import type { ReactNode } from "react";

const searchSchema = z.object({
  query: z.string().default(""),
  first: z.number().int().min(1).default(20),
});
let userId = "alice";
let sequence = 0;
function wrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}
function key() {
  return ["test", ++sequence] as const;
}
function storageKey(resourceKey: ReadonlyArray<string | number>) {
  return `resource-navigation:${JSON.stringify([userId, ...resourceKey])}`;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  userId = "alice";
});

describe("useResourceNavigation", () => {
  it("uses the exact caller key without an authentication provider", () => {
    const resourceKey = ["public", "items", 0];
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema,
        search: { query: "shared" },
      }),
    );
    expect(
      sessionStorage.getItem(
        `resource-navigation:${JSON.stringify(resourceKey)}`,
      ),
    ).toBe(JSON.stringify({ query: "shared", first: 20 }));
    expect(result.current.backSearch).toEqual(result.current.search);
  });

  it("accepts null-prototype router filters when search changes", () => {
    const resourceKey = key();
    const filterSchema = searchSchema.extend({ filter: z.unknown() });
    const makeSearch = (name: string) => ({
      query: "users",
      filter: Object.assign(Object.create(null), { name: { $eq: name } }),
    });
    const { result, rerender } = renderHook(
      ({ search }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey],
          searchSchema: filterSchema,
          search,
        }),
      { wrapper, initialProps: { search: makeSearch("Alice") } },
    );
    rerender({ search: makeSearch("Bob") });
    expect(result.current.search?.filter).toEqual({ name: { $eq: "Bob" } });
    act(() => result.current.setSearch({ query: "manual", filter: {} }));
    rerender({ search: makeSearch("Bob") });
    expect(result.current.search?.query).toBe("manual");
  });

  it("ignores object key order without losing nested filter changes", () => {
    const filterSchema = searchSchema.extend({ filter: z.unknown() });
    const resourceKey = key();
    const { result, rerender } = renderHook(
      ({ filter }: { filter: unknown }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: filterSchema,
          search: { query: "list", filter },
        }),
      {
        wrapper,
        initialProps: {
          filter: { enabled: false, roles: ["admin", "user"] } as unknown,
        },
      },
    );
    act(() => result.current.setSearch({ query: "manual", filter: null }));
    rerender({
      filter: Object.assign(Object.create(null), {
        roles: ["admin", "user"],
        enabled: false,
      }),
    });
    expect(result.current.search).toMatchObject({
      query: "manual",
      filter: null,
    });
    rerender({ filter: { roles: ["user", "admin"], enabled: false } });
    expect(result.current.search).toMatchObject({
      query: "list",
      filter: { roles: ["user", "admin"], enabled: false },
    });
    rerender({ filter: { roles: ["user"], enabled: null } });
    expect(result.current.search.filter).toEqual({
      roles: ["user"],
      enabled: null,
    });
  });

  it("applies supplied search on mount and changes, using the setter's validation and defaults", () => {
    const resourceKey = key();
    sessionStorage.setItem(storageKey(resourceKey), "invalid json");
    const incoming = { query: "list", first: 5, secret: "omit" };
    const initialProps: { search: z.input<typeof searchSchema> } = {
      search: incoming,
    };
    const { result, rerender } = renderHook(
      ({ search }: { search: z.input<typeof searchSchema> }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey],
          searchSchema,
          search,
        }),
      { wrapper, initialProps },
    );
    const reader = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    expect(result.current.search).toEqual({ query: "list", first: 5 });
    expect(
      JSON.parse(sessionStorage.getItem(storageKey(resourceKey))!),
    ).toEqual({
      query: "list",
      first: 5,
    });
    rerender({ search: { query: "changed", first: 10 } });
    expect(reader.result.current.search).toEqual({
      query: "changed",
      first: 10,
    });
    rerender({ search: {} });
    expect(reader.result.current.search).toEqual({ query: "", first: 20 });
  });

  it("treats omitted and undefined search as read-only, with explicit clearing", () => {
    const resourceKey = key();
    const initialProps: { search?: z.input<typeof searchSchema> } = {
      search: { query: "saved" },
    };
    const { result, rerender } = renderHook(
      (options: { search?: z.input<typeof searchSchema> }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey],
          searchSchema,
          ...options,
        }),
      { wrapper, initialProps },
    );
    rerender({});
    expect(result.current.search?.query).toBe("saved");
    rerender({ search: undefined });
    expect(result.current.search?.query).toBe("saved");
    act(() => result.current.clearSearch());
    expect(result.current.search).toEqual(searchSchema.parse({}));
    expect(sessionStorage.getItem(storageKey(resourceKey))).toBeNull();
    act(() => result.current.setSearch({ query: "manual" }));
    rerender({});
    expect(result.current.search?.query).toBe("manual");
    rerender({ search: undefined });
    expect(result.current.search?.query).toBe("manual");
  });

  it("does not replay unchanged search over explicit shared updates", () => {
    const resourceKey = key();
    const setItem = vi.spyOn(
      Object.getPrototypeOf(sessionStorage) as Storage,
      "setItem",
    );
    const { result, rerender } = renderHook(
      ({ search }: { search: z.input<typeof searchSchema> }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey],
          searchSchema,
          search,
        }),
      { wrapper, initialProps: { search: { query: "list" } } },
    );
    expect(setItem).toHaveBeenCalledTimes(1);
    act(() => result.current.setSearch({ query: "manual", first: 5 }));
    rerender({ search: { query: "list" } });
    expect(result.current.search).toEqual({ query: "manual", first: 5 });
    expect(setItem).toHaveBeenCalledTimes(2);
    rerender({ search: { query: "new list" } });
    expect(result.current.search).toEqual({ query: "new list", first: 20 });
    expect(setItem).toHaveBeenCalledTimes(3);
  });

  it("applies search to a changed scope even if the supplied value is unchanged", () => {
    const resourceKey = key();
    const { result, rerender } = renderHook(
      ({ workspace }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey, workspace],
          searchSchema,
          search: { query: "incoming" },
        }),
      { wrapper, initialProps: { workspace: "one" } },
    );
    act(() => result.current.setSearch({ query: "one saved" }));
    rerender({ workspace: "two" });
    expect(result.current.search?.query).toBe("incoming");
    expect(
      JSON.parse(sessionStorage.getItem(storageKey([...resourceKey, "one"]))!)
        .query,
    ).toBe("one saved");
    act(() => result.current.setSearch({ query: "alice saved" }));
    const aliceKey = storageKey([...resourceKey, "two"]);
    userId = "bob";
    rerender({ workspace: "two" });
    expect(result.current.search?.query).toBe("incoming");
    expect(JSON.parse(sessionStorage.getItem(aliceKey)!).query).toBe(
      "alice saved",
    );
    expect(
      JSON.parse(sessionStorage.getItem(storageKey([...resourceKey, "two"]))!)
        .query,
    ).toBe("incoming");
  });

  it("only writes explicitly, synchronizes equal keys, and persists across remounts", () => {
    const resourceKey = key();
    const reader = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    expect(reader.result.current.search).toEqual(searchSchema.parse({}));
    const writer = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    expect(sessionStorage.getItem(storageKey(resourceKey))).toBeNull();
    act(() => writer.result.current.setSearch({ query: "example", first: 5 }));
    expect(reader.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    const setter = writer.result.current.setSearch;
    writer.rerender();
    expect(writer.result.current.setSearch).toBe(setter);
    expect(reader.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    writer.unmount();
    reader.unmount();
    const restored = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    expect(restored.result.current.search).toEqual({
      query: "example",
      first: 5,
    });
    expectTypeOf(restored.result.current.search).toEqualTypeOf<
      z.output<typeof searchSchema>
    >();
    act(() => restored.result.current.setSearch({}));
    expect(restored.result.current.search).toEqual({
      query: "",
      first: 20,
    });
    act(() => restored.result.current.setSearch(undefined));
    expect(restored.result.current.search).toEqual(searchSchema.parse({}));
    expect(sessionStorage.getItem(storageKey(resourceKey))).toBeNull();
  });

  it("isolates caller-provided resource and user scopes", () => {
    const resourceKey = key();
    const writer = renderHook(
      () =>
        useResourceNavigation({
          key: [userId, ...resourceKey, "workspace-one"],
          searchSchema,
        }),
      { wrapper },
    );
    act(() => writer.result.current.setSearch({ query: "private" }));
    const reader = renderHook(
      () =>
        useResourceNavigation({
          key: [userId, ...resourceKey, "workspace-two"],
          searchSchema,
        }),
      { wrapper },
    );
    expect(reader.result.current.search).toEqual(searchSchema.parse({}));
    const scoped = renderHook(
      () =>
        useResourceNavigation({
          key: [userId, ...resourceKey, "workspace-one"],
          searchSchema,
        }),
      { wrapper },
    );
    expect(scoped.result.current.search?.query).toBe("private");
    userId = "bob";
    scoped.rerender();
    expect(scoped.result.current.search).toEqual(searchSchema.parse({}));
    act(() => scoped.result.current.setSearch({ query: "bob only" }));
    userId = "alice";
    scoped.rerender();
    expect(scoped.result.current.search?.query).toBe("private");
  });

  it.each(["not json", "null", "[]", '{"first":-1}', '{"query":{}}'])(
    "discards invalid stored search: %s",
    (raw) => {
      const resourceKey = key();
      sessionStorage.setItem(storageKey(resourceKey), raw);
      sessionStorage.setItem("unrelated", "keep");
      const { result } = renderHook(
        () =>
          useResourceNavigation({
            key: [userId, ...resourceKey],
            searchSchema,
          }),
        { wrapper },
      );
      expect(result.current.search).toEqual(searchSchema.parse({}));
      expect(sessionStorage.getItem(storageKey(resourceKey))).toBeNull();
      expect(sessionStorage.getItem("unrelated")).toBe("keep");
    },
  );

  it("validates reads, strips unknown fields and observes storage events", () => {
    const resourceKey = key();
    sessionStorage.setItem(
      storageKey(resourceKey),
      JSON.stringify({ query: "example", secret: "not search" }),
    );
    const { result } = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    expect(result.current.search).toEqual({ query: "example", first: 20 });
    act(() => {
      sessionStorage.setItem(
        storageKey(resourceKey),
        JSON.stringify({ query: "updated" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: storageKey(resourceKey) }),
      );
    });
    expect(result.current.search?.query).toBe("updated");
  });

  it.each(["getItem", "setItem"] as const)(
    "falls back to synchronized memory when %s is unavailable",
    (method) => {
      const resourceKey = key();
      vi.spyOn(
        Object.getPrototypeOf(sessionStorage) as Storage,
        method,
      ).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      const reader = renderHook(
        () =>
          useResourceNavigation({
            key: [userId, ...resourceKey],
            searchSchema,
          }),
        { wrapper },
      );
      const writer = renderHook(
        () =>
          useResourceNavigation({
            key: [userId, ...resourceKey],
            searchSchema,
          }),
        { wrapper },
      );
      act(() => writer.result.current.setSearch({ query: "fallback" }));
      expect(reader.result.current.search?.query).toBe("fallback");
    },
  );

  it("applies functional updates to the latest shared value, including before rerender", () => {
    const resourceKey = key();
    const first = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    const second = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    act(() => {
      first.result.current.setSearch((previous) => ({
        query: previous?.query ?? "initial",
        first: 5,
      }));
      second.result.current.setSearch((previous) => ({
        ...previous,
        first: previous!.first + 1,
      }));
      first.result.current.setSearch((previous) => ({
        ...previous,
        first: previous!.first + 1,
      }));
    });
    expect(first.result.current.search).toEqual({
      query: "initial",
      first: 7,
    });
    expect(second.result.current.search).toEqual(first.result.current.search);
  });

  it("validates writes without replacing valid search on failure and avoids duplicate writes", () => {
    const resourceKey = key();
    const { result } = renderHook(
      () =>
        useResourceNavigation({ key: [userId, ...resourceKey], searchSchema }),
      { wrapper },
    );
    const setItem = vi.spyOn(
      Object.getPrototypeOf(sessionStorage) as Storage,
      "setItem",
    );
    const input = { query: "saved", secret: "must not persist" };
    act(() => result.current.setSearch(input));
    expect(
      JSON.parse(sessionStorage.getItem(storageKey(resourceKey))!),
    ).toEqual({
      query: "saved",
      first: 20,
    });
    act(() => result.current.setSearch({ query: "saved", first: 20 }));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(() => result.current.setSearch({ first: 0 })).toThrow();
    expect(() => result.current.setSearch(() => ({ first: 0 }))).toThrow();
    expect(result.current.search).toEqual({ query: "saved", first: 20 });
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("switches the setter's workspace key without modifying the previous scope", () => {
    const resourceKey = key();
    const { result, rerender } = renderHook(
      ({ workspace }) =>
        useResourceNavigation({
          key: [userId, ...resourceKey, workspace],
          searchSchema,
        }),
      { wrapper, initialProps: { workspace: "one" } },
    );
    act(() => result.current.setSearch({ query: "one" }));
    rerender({ workspace: "two" });
    expect(result.current.search).toEqual(searchSchema.parse({}));
    act(() => result.current.setSearch({ query: "two" }));
    rerender({ workspace: "one" });
    expect(result.current.search?.query).toBe("one");
  });
});
