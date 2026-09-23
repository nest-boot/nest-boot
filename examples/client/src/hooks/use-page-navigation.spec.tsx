// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { useCallback } from "react";
import { usePageSearch } from "./use-page-search";
import { usePageNavigation } from "./use-page-navigation";
import type { ReactNode } from "react";
import type {
  PageNavigationEdge,
  PageNavigationQueryOptions,
  PageNavigationQueryResult,
} from "./use-page-navigation";
import { CurrentUserProvider } from "@/app/_authenticated/contexts/current-user-context";
import { apiKeySearchSchema } from "@/lib/api-key-search";
import { createConnectionCursor } from "@/lib/connection-cursor";
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
    prevEdge: previous
      ? { cursor: previous, node: { id: previous } }
      : undefined,
    nextEdge: next ? { cursor: next, node: { id: next } } : undefined,
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
  it("executes the lazy-query closure for changed conditions or closures, but not saved pagination", async () => {
    const query = vi.fn().mockResolvedValue(neighbors("A", "C"));
    const { result, rerender } = renderHook(
      ({ execute }) =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          query: execute,
        }),
      { wrapper, initialProps: { execute: query } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: apiKeySearchSchema.parse({}),
    });
    // Only the closure receives query arguments; pages consume the final search.
    expect(result.current).not.toHaveProperty("previousSearch");
    expect(result.current).not.toHaveProperty("nextSearch");
    expect(result.current).not.toHaveProperty("getBackSearch");
    expect(result.current).not.toHaveProperty("currentCursor");
    type Options = Parameters<
      typeof usePageNavigation<typeof apiKeySearchSchema>
    >[0];
    expectTypeOf<Pick<Options, "query">>().toEqualTypeOf<
      Required<Pick<Options, "query">>
    >();
    expectTypeOf<Extract<keyof Options, "record">>().toEqualTypeOf<never>();
    expectTypeOf<Parameters<Options["query"]>[0]>().toEqualTypeOf<{
      pageSearch: z.output<typeof apiKeySearchSchema>;
    }>();
    expectTypeOf<PageNavigationQueryResult>().toEqualTypeOf<{
      prevEdge?: PageNavigationEdge;
      nextEdge?: PageNavigationEdge;
    }>();
    expectTypeOf<PageNavigationEdge["node"]["id"]>().toEqualTypeOf<
      string | number
    >();
    rerender({ execute: query });
    act(() => result.current.setPageSearch({ first: 5, after: "saved" }));
    expect(query).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.setPageSearch((saved) => ({ ...saved, query: "changed" })),
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
      pageSearch: expect.objectContaining({
        query: "changed",
        first: 5,
        after: "B",
      }),
    });
    expect(result.current.prevEdge?.node.id).toBe("B");
    expect(result.current.nextEdge).toBeUndefined();
  });

  it("accepts numeric IDs including zero and retains the complete preceding cursor", async () => {
    const saved = saveSearch({ first: 5, after: "old" });
    const data: PageNavigationQueryResult = {
      prevEdge: {
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
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prevEdge).toEqual(data.prevEdge);
    expect(result.current.nextEdge).toEqual(data.nextEdge);
    expect(result.current.backSearch).toMatchObject({
      first: 5,
      after: data.prevEdge?.cursor,
    });
    expect(saved.result.current.pageSearch).toEqual(result.current.backSearch);
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
          query,
        }),
      { wrapper },
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.backSearch).toEqual(search);
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.loading).toBe(false);
    expect(result.current.prevEdge).toBeUndefined();
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
    expect(result.current.prevEdge).toBeUndefined();
  });

  it("treats a missing query owner as a failure rather than the first record", async () => {
    saveSearch({ after: "saved" });
    const query = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
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
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: { first: 10 },
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
            query,
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(query).toHaveBeenLastCalledWith({
        pageSearch: { query: "example", orderBy, first: 5, after: "old" },
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
            query,
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(query).toHaveBeenLastCalledWith({
        pageSearch: apiKeySearchSchema.parse({ ...conditions, ...pagination }),
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
    expect(result.current.prevEdge).toBeUndefined();
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
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      { wrapper, initialProps: { query: firstQuery } },
    );
    await act(async () => {
      initial.resolve(neighbors("A", "C"));
      await initial.promise;
    });
    expect(result.current.prevEdge?.node.id).toBe("A");
    rerender({ query: otherQuery });
    expect(result.current.loading).toBe(true);
    expect(result.current.prevEdge).toBeUndefined();
    expect(result.current.backSearch).toMatchObject({ after: "A" });
    rerender({ query: firstQuery });
    expect(result.current.prevEdge).toBeUndefined();
    await act(async () => {
      returned.resolve(neighbors("A", "C"));
      await returned.promise;
    });
    await act(async () => {
      switched.resolve(neighbors("B", "D"));
      await switched.promise;
    });
    expect(result.current.prevEdge?.node.id).toBe("A");
    expect(result.current.nextEdge?.node.id).toBe("C");
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
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          query: useCallback(
            ({
              pageSearch,
            }: PageNavigationQueryOptions<typeof apiKeySearchSchema>) =>
              execute({
                pageSearch,
                cursor: createConnectionCursor(item, pageSearch),
              }),
            [item, execute],
          ),
        }),
      { wrapper, initialProps: { item: record } },
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
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
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
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: result.current.pageSearch,
    });
    expect(result.current.prevEdge?.node.id).toBe("previous");
    expect(sessionStorage.length).toBe(0);
  });

  it("applies schema sort defaults to an existing saved search without orderBy", async () => {
    const query = vi.fn().mockResolvedValue(neighbors());
    sessionStorage.setItem(
      'page-search:v1:["navigation-user","api-keys"]',
      JSON.stringify({ first: 5, query: "example" }),
    );
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pageSearch.orderBy.field).toBe(
      UserApiKeyOrderField.CREATED_AT,
    );
    expect(result.current.backSearch).toMatchObject({ first: 5 });
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: result.current.pageSearch,
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
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: ["other-resource"],
          searchSchema,
          query,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenLastCalledWith({
      pageSearch: result.current.pageSearch,
    });
    expect(result.current.backSearch).toMatchObject({
      first: 7,
      orderBy: { field: "NAME", direction: OrderDirection.ASC },
    });
  });
});
