// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { usePageSearch } from "./use-page-search";
import { usePageNavigation } from "./use-page-navigation";
import type { ReactNode } from "react";
import type { PageNavigationQueryResult } from "./use-page-navigation";
import { CurrentUserProvider } from "@/app/_authenticated/contexts/current-user-context";
import { apiKeySearchSchema } from "@/lib/api-key-search";
import { UserApiKeyOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider
      value={{
        id: "navigation-user",
        name: "Test",
        email: "test@example.com",
        permissions: [],
      }}
    >
      {children}
    </CurrentUserProvider>
  );
}
const pageKey = ["api-keys"];
const record = {
  id: "B",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastUsedAt: null,
};
const conditions = {
  query: "example*",
  filter: { prefix: { $eq: "sk" } },
  orderBy: { field: UserApiKeyOrderField.ID, direction: OrderDirection.ASC },
};
function neighbors(
  previous?: string,
  next?: string,
): PageNavigationQueryResult {
  return {
    previous: {
      edges: previous ? [{ cursor: previous, node: { id: previous } }] : [],
    },
    next: { edges: next ? [{ cursor: next, node: { id: next } }] : [] },
  };
}
function saveSearch(search: z.input<typeof apiKeySearchSchema>, key = pageKey) {
  const saved = renderHook(
    () => usePageSearch({ key, searchSchema: apiKeySearchSchema }),
    { wrapper },
  );
  act(() => saved.result.current.setPageSearch(search));
  return saved;
}
function deferred() {
  let resolve!: (value: PageNavigationQueryResult) => void;
  const promise = new Promise<PageNavigationQueryResult>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("usePageNavigation", () => {
  it("executes the lazy-query closure for changed conditions or records, but not saved pagination", async () => {
    const query = vi.fn().mockResolvedValue(neighbors("A", "C"));
    const { result, rerender } = renderHook(
      ({ item, execute }) =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record: item,
          query: execute,
        }),
      { wrapper, initialProps: { item: record, execute: query } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const cursor = btoa(JSON.stringify({ id: "B", value: record.createdAt }));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: apiKeySearchSchema.parse({}),
      cursor,
    });
    // Only the closure receives query arguments; pages consume the final search.
    expect(result.current).not.toHaveProperty("previousSearch");
    expect(result.current).not.toHaveProperty("nextSearch");
    expect(result.current).not.toHaveProperty("getBackSearch");
    rerender({ item: { ...record }, execute: query });
    act(() => result.current.setPageSearch({ first: 5, after: "saved" }));
    expect(query).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.setPageSearch((saved) => ({ ...saved, query: "changed" })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(2);
    rerender({ item: { ...record, id: "C" }, execute: query });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(3);
    const otherQuery = vi.fn().mockResolvedValue(neighbors("B"));
    rerender({ item: { ...record, id: "C" }, execute: otherQuery });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(otherQuery).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(otherQuery).toHaveBeenCalledTimes(2);
    expect(otherQuery).toHaveBeenLastCalledWith({
      pageSearch: expect.objectContaining({
        query: "changed",
        first: 5,
        after: "B",
      }),
      cursor: btoa(JSON.stringify({ id: "C", value: record.createdAt })),
    });
    expect(result.current.previous?.node.id).toBe("B");
    expect(result.current.next).toBeUndefined();
  });

  it("retains saved search during loading and failure, and retries without page-owned query state", async () => {
    const search = apiKeySearchSchema.parse({
      ...conditions,
      first: 5,
      after: "old",
    });
    saveSearch(search);
    const error = new Error("Neighbor query failed");
    const query = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(neighbors("A", "C"));
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
          query,
        }),
      { wrapper },
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.backSearch).toEqual(search);
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.loading).toBe(false);
    expect(result.current.previous).toBeUndefined();
    expect(result.current.next).toBeUndefined();
    expect(result.current.backSearch).toEqual(search);
    await act(async () => {
      await result.current.refetch();
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeUndefined();
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    query.mockRejectedValueOnce(error);
    await act(async () => {
      await expect(result.current.refetch()).rejects.toBe(error);
    });
    expect(result.current.error).toBe(error);
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    expect(result.current.previous).toBeUndefined();
  });

  it("treats a missing query owner as a failure rather than the first record", async () => {
    saveSearch({ after: "saved" });
    const query = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.backSearch).toMatchObject({ after: "saved" });
  });

  it("accepts a schema without an orderBy property on direct entry", async () => {
    const searchSchema = z.object({ first: z.number().default(10) });
    const query = vi.fn().mockResolvedValue(neighbors("A", "C"));
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: ["id-only"],
          searchSchema,
          record: { id: "B" },
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const cursor = btoa(JSON.stringify({ id: "B" }));
    expect(result.current.currentCursor).toBe(cursor);
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: { first: 10 },
      cursor,
    });
    expect(result.current.backSearch).toEqual({ first: 10 });
    expect(sessionStorage.length).toBe(0);
  });

  it.each([undefined, null])(
    "retains filters and return pagination when saved ordering is %s",
    async (orderBy) => {
      const searchSchema = z.object({
        first: z.number().default(10),
        after: z.string().optional(),
        query: z.string().optional(),
        orderBy: z.object({ field: z.string() }).nullish(),
      });
      const saved = renderHook(
        () => usePageSearch({ key: ["id-only"], searchSchema }),
        { wrapper },
      );
      act(() =>
        saved.result.current.setPageSearch({
          first: 5,
          after: "old",
          query: "example",
          orderBy,
        }),
      );
      const query = vi.fn().mockResolvedValue(neighbors("previous"));
      const { result } = renderHook(
        () =>
          usePageNavigation({
            key: ["id-only"],
            searchSchema,
            record: { id: "B" },
            query,
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      const cursor = btoa(JSON.stringify({ id: "B" }));
      expect(query).toHaveBeenLastCalledWith({
        pageSearch: { query: "example", orderBy, first: 5, after: "old" },
        cursor,
      });
      expect(result.current.backSearch).toEqual({
        query: "example",
        orderBy,
        first: 5,
        after: "previous",
      });
      expect(saved.result.current.pageSearch).toEqual(
        result.current.backSearch,
      );
    },
  );

  it.each([
    { first: 5, after: "old" },
    { last: 5, before: "old" },
  ])(
    "preserves filters and size but replaces pagination: %j",
    async (pagination) => {
      const saved = saveSearch({ ...conditions, ...pagination });
      const query = vi.fn().mockResolvedValue(neighbors("previous", "next"));
      const { result } = renderHook(
        () =>
          usePageNavigation({
            key: pageKey,
            searchSchema: apiKeySearchSchema,
            record,
            query,
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      const cursor = btoa(JSON.stringify({ id: record.id, value: record.id }));
      expect(query).toHaveBeenLastCalledWith({
        pageSearch: apiKeySearchSchema.parse({ ...conditions, ...pagination }),
        cursor,
      });
      expect(result.current.backSearch).toEqual({
        ...conditions,
        first: 5,
        after: "previous",
      });
      expect(saved.result.current.pageSearch).toEqual(
        result.current.backSearch,
      );
    },
  );

  it("returns the filtered first page when the current record has no predecessor", async () => {
    const saved = saveSearch({ ...conditions, first: 5, after: "old" });
    const query = vi.fn().mockResolvedValue(neighbors(undefined, "B"));
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record: { ...record, id: "A" },
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backSearch).toEqual({
      ...conditions,
      first: 5,
      after: undefined,
    });
    expect(saved.result.current.pageSearch).toEqual(result.current.backSearch);
    expect(result.current.previous).toBeUndefined();
    expect(result.current.next?.node.id).toBe("B");
  });

  it("ignores obsolete results after switching records and browser back", async () => {
    const saved = saveSearch({ ...conditions, first: 5, after: "old" });
    const initial = deferred();
    const switched = deferred();
    const returned = deferred();
    const query = vi
      .fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(switched.promise)
      .mockReturnValueOnce(returned.promise);
    const { result, rerender } = renderHook(
      ({ item }) =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record: item,
          query,
        }),
      { wrapper, initialProps: { item: record } },
    );
    await act(async () => {
      initial.resolve(neighbors("A", "C"));
      await initial.promise;
    });
    expect(result.current.previous?.node.id).toBe("A");
    rerender({ item: { ...record, id: "C" } });
    expect(result.current.loading).toBe(true);
    expect(result.current.previous).toBeUndefined();
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    rerender({ item: record });
    expect(result.current.previous).toBeUndefined();
    await act(async () => {
      returned.resolve(neighbors("A", "C"));
      await returned.promise;
    });
    await act(async () => {
      switched.resolve(neighbors("B", "D"));
      await switched.promise;
    });
    expect(result.current.previous?.node.id).toBe("A");
    expect(result.current.next?.node.id).toBe("C");
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    expect(saved.result.current.pageSearch).toMatchObject({ after: "A" });
  });

  it("isolates pending requests and saved positions when the workspace key changes", async () => {
    const firstKey = ["workspaces", "one", "api-keys"];
    const secondKey = ["workspaces", "two", "api-keys"];
    const first = saveSearch(
      { ...conditions, first: 5, after: "one-old" },
      firstKey,
    );
    const second = saveSearch(
      { ...conditions, first: 3, after: "two-old" },
      secondKey,
    );
    const oldRequest = deferred();
    const newRequest = deferred();
    const query = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const { result, rerender } = renderHook(
      ({ key }) =>
        usePageNavigation({
          key,
          searchSchema: apiKeySearchSchema,
          record,
          query,
        }),
      { wrapper, initialProps: { key: firstKey } },
    );
    rerender({ key: secondKey });
    expect(result.current.backSearch).toMatchObject({ after: "two-old" });
    await act(async () => {
      newRequest.resolve(neighbors("two-previous"));
      await newRequest.promise;
    });
    await act(async () => {
      oldRequest.resolve(neighbors("one-previous"));
      await oldRequest.promise;
    });
    expect(result.current.backSearch).toMatchObject({
      first: 3,
      after: "two-previous",
    });
    expect(first.result.current.pageSearch).toMatchObject({ after: "one-old" });
    expect(second.result.current.pageSearch).toMatchObject({
      after: "two-previous",
    });
  });

  it("does not save late results after unmount", async () => {
    const saved = saveSearch({ first: 5, after: "original" });
    const pending = deferred();
    const query = vi.fn().mockReturnValue(pending.promise);
    const { unmount } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
          query,
        }),
      { wrapper },
    );
    unmount();
    await act(async () => {
      pending.resolve(neighbors("late"));
      await pending.promise;
    });
    expect(saved.result.current.pageSearch).toMatchObject({
      after: "original",
    });
  });

  it("derives cursors from live record data, including browser-back and null sort values, without a stored cursor map", () => {
    saveSearch({
      orderBy: {
        field: UserApiKeyOrderField.LAST_USED_AT,
        direction: OrderDirection.DESC,
      },
    });
    const stored = JSON.stringify(sessionStorage);
    const { result, rerender } = renderHook(
      ({ item }) =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record: item,
        }),
      { wrapper, initialProps: { item: record } },
    );
    const original = result.current.currentCursor;
    expect(JSON.parse(atob(original))).toEqual({ id: "B", value: null });
    rerender({ item: { ...record, id: "C" } });
    expect(result.current.currentCursor).not.toBe(original);
    rerender({ item: record });
    expect(result.current.currentCursor).toBe(original);
    expect(JSON.stringify(sessionStorage)).toBe(stored);
  });

  it("uses schema defaults on direct entry even after neighbors load, without writing a fake list visit", async () => {
    const query = vi.fn().mockResolvedValue(neighbors("previous", "next"));
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backSearch).toEqual({
      first: 20,
      orderBy: {
        field: UserApiKeyOrderField.CREATED_AT,
        direction: OrderDirection.DESC,
      },
    });
    expect(JSON.parse(atob(result.current.currentCursor))).toEqual({
      id: record.id,
      value: record.createdAt,
    });
    expect(result.current.previous?.node.id).toBe("previous");
    expect(sessionStorage.length).toBe(0);
  });

  it("applies schema sort defaults to an existing saved search without orderBy", () => {
    sessionStorage.setItem(
      'page-search:v1:["navigation-user","api-keys"]',
      JSON.stringify({ first: 5, query: "example" }),
    );
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
        }),
      { wrapper },
    );
    expect(result.current.pageSearch.orderBy.field).toBe(
      UserApiKeyOrderField.CREATED_AT,
    );
    expect(result.current.backSearch).toMatchObject({ first: 5 });
    expect(JSON.parse(atob(result.current.currentCursor))).toEqual({
      id: record.id,
      value: record.createdAt,
    });
  });

  it("uses another resource's schema defaults instead of hardcoded API-key ordering", () => {
    const searchSchema = createConnectionSearchSchema({
      pageSize: 7,
      orderField: { NAME: "NAME" } as const,
      defaultOrderField: "NAME",
      defaultOrderDirection: OrderDirection.ASC,
    });
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: ["other-resource"],
          searchSchema,
          record: { id: "1", name: "Alice" },
        }),
      { wrapper },
    );
    expect(JSON.parse(atob(result.current.currentCursor))).toEqual({
      id: "1",
      value: "Alice",
    });
    expect(result.current.backSearch).toMatchObject({
      first: 7,
      orderBy: { field: "NAME", direction: OrderDirection.ASC },
    });
  });
});
