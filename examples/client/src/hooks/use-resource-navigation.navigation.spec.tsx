// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { useCallback } from "react";
import { useResourceNavigation } from "./use-resource-navigation";
import type {
  ResourceNavigationEdge,
  ResourceNavigationQueryOptions,
  ResourceNavigationQueryResult,
} from "./use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { createConnectionCursor } from "@/lib/connection-cursor";
import { UserApiKeyOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";

const resourceKey = ["navigation-user", "api-keys"];
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
): ResourceNavigationQueryResult {
  return {
    previousEdge: previous
      ? { cursor: previous, node: { id: previous } }
      : undefined,
    nextEdge: next ? { cursor: next, node: { id: next } } : undefined,
  };
}
function saveSearch(
  search: z.input<typeof apiKeySearchSchema>,
  key = resourceKey,
) {
  const saved = renderHook(() =>
    useResourceNavigation({ key, searchSchema: apiKeySearchSchema }),
  );
  act(() => saved.result.current.setSearch(search));
  return saved;
}
function deferred() {
  let resolve!: (value: ResourceNavigationQueryResult) => void;
  const promise = new Promise<ResourceNavigationQueryResult>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("useResourceNavigation", () => {
  it("reads defaults without querying or recording a list visit when query is omitted", async () => {
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
      }),
    );
    expect(result.current.search).toEqual(apiKeySearchSchema.parse({}));
    expect(result.current.backSearch).toEqual(result.current.search);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.previousEdge).toBeUndefined();
    expect(result.current.nextEdge).toBeUndefined();
    await expect(result.current.refetch()).resolves.toBeUndefined();
    expect(sessionStorage.length).toBe(0);
  });

  it("queries supplied search immediately and retains schema-defined view metadata", async () => {
    const searchSchema = apiKeySearchSchema.and(
      z.object({ savedViewId: z.string().optional() }),
    );
    const query = vi.fn().mockResolvedValue(neighbors("previous", "next"));
    saveSearch({ query: "old" });
    const { result, rerender } = renderHook(
      ({ search }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema,
          search,
          query,
        }),
      {
        initialProps: {
          search: {
            query: "incoming",
            savedViewId: "view-one",
            first: 5,
            after: "old",
          },
        },
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith({
      search: searchSchema.parse({
        query: "incoming",
        savedViewId: "view-one",
        first: 5,
        after: "old",
      }),
    });
    expect(result.current.backSearch).toMatchObject({
      savedViewId: "view-one",
      after: "previous",
    });
    rerender({
      search: {
        query: "incoming",
        savedViewId: "view-two",
        first: 5,
        after: "old",
      },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith({
      search: searchSchema.parse({
        query: "incoming",
        savedViewId: "view-two",
        first: 5,
        after: "old",
      }),
    });
    expect(result.current.search).toMatchObject({
      savedViewId: "view-two",
      after: "previous",
    });
  });

  it("discards a pending result when query is removed and can enable it again", async () => {
    const saved = saveSearch({ after: "original" });
    const pending = deferred();
    const query = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(neighbors("fresh"));
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: apiKeySearchSchema,
          query: enabled ? query : undefined,
        }),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);
    await act(async () => {
      pending.resolve(neighbors("stale"));
      await pending.promise;
    });
    expect(result.current.previousEdge).toBeUndefined();
    expect(saved.result.current.search).toMatchObject({ after: "original" });
    rerender({ enabled: true });
    await waitFor(() =>
      expect(result.current.previousEdge?.node.id).toBe("fresh"),
    );
    expect(saved.result.current.search).toMatchObject({ after: "fresh" });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("executes the lazy-query closure for changed conditions or closures, but not saved pagination", async () => {
    const query = vi.fn().mockResolvedValue(neighbors("A", "C"));
    const { result, rerender } = renderHook(
      ({ execute }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: apiKeySearchSchema,
          query: execute,
        }),
      { initialProps: { execute: query } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith({
      search: apiKeySearchSchema.parse({}),
    });
    // Only the closure receives query arguments; pages consume the final search.
    expect(result.current).not.toHaveProperty("previousSearch");
    expect(result.current).not.toHaveProperty("nextSearch");
    expect(result.current).not.toHaveProperty("getBackSearch");
    expect(result.current).not.toHaveProperty("currentCursor");
    type Options = Parameters<
      typeof useResourceNavigation<typeof apiKeySearchSchema>
    >[0];
    expectTypeOf<Pick<Options, "query">>().toEqualTypeOf<
      Partial<Pick<Options, "query">>
    >();
    expectTypeOf<Extract<keyof Options, "record">>().toEqualTypeOf<never>();
    expectTypeOf<Parameters<NonNullable<Options["query"]>>[0]>().toEqualTypeOf<{
      search: z.output<typeof apiKeySearchSchema>;
    }>();
    expectTypeOf<ResourceNavigationQueryResult>().toEqualTypeOf<{
      previousEdge?: ResourceNavigationEdge;
      nextEdge?: ResourceNavigationEdge;
    }>();
    expectTypeOf<ResourceNavigationEdge["node"]["id"]>().toEqualTypeOf<
      string | number
    >();
    rerender({ execute: query });
    act(() => result.current.setSearch({ first: 5, after: "saved" }));
    expect(query).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.setSearch((saved) => ({ ...saved, query: "changed" })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(2);
    const otherQuery = vi.fn().mockResolvedValue(neighbors("B"));
    rerender({ execute: otherQuery });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(otherQuery).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(otherQuery).toHaveBeenCalledTimes(2);
    expect(otherQuery).toHaveBeenLastCalledWith({
      search: expect.objectContaining({
        query: "changed",
        first: 5,
        after: "B",
      }),
    });
    expect(result.current.previousEdge?.node.id).toBe("B");
    expect(result.current.nextEdge).toBeUndefined();
  });

  it("accepts numeric IDs including zero and retains the complete preceding cursor", async () => {
    const saved = saveSearch({ first: 5, after: "old" });
    const data: ResourceNavigationQueryResult = {
      previousEdge: {
        cursor: btoa(
          JSON.stringify({ id: 0, value: "2026-09-23T10:00:00.000Z" }),
        ),
        node: { id: 0 },
      },
      nextEdge: {
        cursor: btoa(
          JSON.stringify({ id: 2, value: "2026-09-21T10:00:00.000Z" }),
        ),
        node: { id: 2 },
      },
    };
    const query = vi.fn().mockResolvedValue(data);
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.previousEdge).toEqual(data.previousEdge);
    expect(result.current.nextEdge).toEqual(data.nextEdge);
    expect(result.current.backSearch).toMatchObject({
      first: 5,
      after: data.previousEdge?.cursor,
    });
    expect(saved.result.current.search).toEqual(result.current.backSearch);
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
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.backSearch).toEqual(search);
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.loading).toBe(false);
    expect(result.current.previousEdge).toBeUndefined();
    expect(result.current.nextEdge).toBeUndefined();
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
    expect(result.current.previousEdge).toBeUndefined();
  });

  it("treats a missing query owner as a failure rather than the first record", async () => {
    saveSearch({ after: "saved" });
    const query = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.backSearch).toMatchObject({ after: "saved" });
  });

  it("accepts a schema without an orderBy property on direct entry", async () => {
    const searchSchema = z.object({ first: z.number().default(10) });
    const query = vi.fn().mockResolvedValue(neighbors("A", "C"));
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: ["id-only"],
        searchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenLastCalledWith({
      search: { first: 10 },
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
      const saved = renderHook(() =>
        useResourceNavigation({ key: ["id-only"], searchSchema }),
      );
      act(() =>
        saved.result.current.setSearch({
          first: 5,
          after: "old",
          query: "example",
          orderBy,
        }),
      );
      const query = vi.fn().mockResolvedValue(neighbors("previous"));
      const { result } = renderHook(() =>
        useResourceNavigation({
          key: ["id-only"],
          searchSchema,
          query,
        }),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(query).toHaveBeenLastCalledWith({
        search: { query: "example", orderBy, first: 5, after: "old" },
      });
      expect(result.current.backSearch).toEqual({
        query: "example",
        orderBy,
        first: 5,
        after: "previous",
      });
      expect(saved.result.current.search).toEqual(result.current.backSearch);
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
      const { result } = renderHook(() =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(query).toHaveBeenLastCalledWith({
        search: apiKeySearchSchema.parse({ ...conditions, ...pagination }),
      });
      expect(result.current.backSearch).toEqual({
        ...conditions,
        first: 5,
        after: "previous",
      });
      expect(saved.result.current.search).toEqual(result.current.backSearch);
    },
  );

  it("returns the filtered first page when the current record has no predecessor", async () => {
    const saved = saveSearch({ ...conditions, first: 5, after: "old" });
    const query = vi.fn().mockResolvedValue(neighbors(undefined, "B"));
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backSearch).toEqual({
      ...conditions,
      first: 5,
      after: undefined,
    });
    expect(saved.result.current.search).toEqual(result.current.backSearch);
    expect(result.current.previousEdge).toBeUndefined();
    expect(result.current.nextEdge?.node.id).toBe("B");
  });

  it("ignores obsolete results after switching records and browser back", async () => {
    const saved = saveSearch({ ...conditions, first: 5, after: "old" });
    const initial = deferred();
    const switched = deferred();
    const returned = deferred();
    const firstQuery = vi
      .fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(returned.promise);
    const otherQuery = vi.fn().mockReturnValueOnce(switched.promise);
    const { result, rerender } = renderHook(
      ({ query }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      { initialProps: { query: firstQuery } },
    );
    await act(async () => {
      initial.resolve(neighbors("A", "C"));
      await initial.promise;
    });
    expect(result.current.previousEdge?.node.id).toBe("A");
    rerender({ query: otherQuery });
    expect(result.current.loading).toBe(true);
    expect(result.current.previousEdge).toBeUndefined();
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    rerender({ query: firstQuery });
    expect(result.current.previousEdge).toBeUndefined();
    await act(async () => {
      returned.resolve(neighbors("A", "C"));
      await returned.promise;
    });
    await act(async () => {
      switched.resolve(neighbors("B", "D"));
      await switched.promise;
    });
    expect(result.current.previousEdge?.node.id).toBe("A");
    expect(result.current.nextEdge?.node.id).toBe("C");
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    expect(saved.result.current.search).toMatchObject({ after: "A" });
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
        useResourceNavigation({
          key,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      { initialProps: { key: firstKey } },
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
    expect(first.result.current.search).toMatchObject({ after: "one-old" });
    expect(second.result.current.search).toMatchObject({
      after: "two-previous",
    });
  });

  it("does not save late results after unmount", async () => {
    const saved = saveSearch({ first: 5, after: "original" });
    const pending = deferred();
    const query = vi.fn().mockReturnValue(pending.promise);
    const { unmount } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    unmount();
    await act(async () => {
      pending.resolve(neighbors("late"));
      await pending.promise;
    });
    expect(saved.result.current.search).toMatchObject({
      after: "original",
    });
  });

  it("calculates live cursors inside the query closure across record changes and browser back", async () => {
    saveSearch({
      orderBy: {
        field: UserApiKeyOrderField.LAST_USED_AT,
        direction: OrderDirection.DESC,
      },
    });
    const stored = JSON.stringify(sessionStorage);
    const execute = vi.fn().mockResolvedValue(neighbors());
    const { result, rerender } = renderHook(
      ({ item }) =>
        useResourceNavigation({
          key: resourceKey,
          searchSchema: apiKeySearchSchema,
          query: useCallback(
            ({
              search,
            }: ResourceNavigationQueryOptions<typeof apiKeySearchSchema>) =>
              execute({
                search,
                cursor: createConnectionCursor(item, search),
              }),
            [item, execute],
          ),
        }),
      { initialProps: { item: record } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const original = btoa(JSON.stringify({ id: "B", value: null }));
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: original }),
    );
    rerender({ item: { ...record, id: "C" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: btoa(JSON.stringify({ id: "C", value: null })),
      }),
    );
    rerender({ item: record });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: original }),
    );
    expect(execute).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(sessionStorage)).toBe(stored);
  });

  it("uses schema defaults on direct entry even after neighbors load, without writing a fake list visit", async () => {
    const query = vi.fn().mockResolvedValue(neighbors("previous", "next"));
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backSearch).toEqual({
      first: 20,
      orderBy: {
        field: UserApiKeyOrderField.CREATED_AT,
        direction: OrderDirection.DESC,
      },
    });
    expect(query).toHaveBeenLastCalledWith({
      search: result.current.search,
    });
    expect(result.current.previousEdge?.node.id).toBe("previous");
    expect(sessionStorage.length).toBe(0);
  });

  it("applies schema sort defaults to an existing saved search without orderBy", async () => {
    const query = vi.fn().mockResolvedValue(neighbors());
    sessionStorage.setItem(
      'resource-navigation:["navigation-user","api-keys"]',
      JSON.stringify({ first: 5, query: "example" }),
    );
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: resourceKey,
        searchSchema: apiKeySearchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.search.orderBy.field).toBe(
      UserApiKeyOrderField.CREATED_AT,
    );
    expect(result.current.backSearch).toMatchObject({ first: 5 });
    expect(query).toHaveBeenLastCalledWith({
      search: result.current.search,
    });
  });

  it("uses another resource's schema defaults instead of hardcoded API-key ordering", async () => {
    const query = vi.fn().mockResolvedValue(neighbors());
    const searchSchema = createConnectionSearchSchema({
      pageSize: 7,
      orderField: { NAME: "NAME" } as const,
      defaultOrderField: "NAME",
      defaultOrderDirection: OrderDirection.ASC,
    });
    const { result } = renderHook(() =>
      useResourceNavigation({
        key: ["other-resource"],
        searchSchema,
        query,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenLastCalledWith({
      search: result.current.search,
    });
    expect(result.current.backSearch).toMatchObject({
      first: 7,
      orderBy: { field: "NAME", direction: OrderDirection.ASC },
    });
  });
});
