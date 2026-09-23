// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { usePageSearch } from "./use-page-search";
import { usePageNavigation } from "./use-page-navigation";
import type { ReactNode } from "react";
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
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("usePageNavigation", () => {
  it("accepts a schema without an orderBy property on direct entry", () => {
    const searchSchema = z.object({ first: z.number().default(10) });
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: ["id-only"],
          searchSchema,
          record: { id: "B" },
        }),
      { wrapper },
    );
    const cursor = btoa(JSON.stringify({ id: "B" }));
    expect(result.current.currentCursor).toBe(cursor);
    expect(result.current.previousSearch).toEqual({ last: 1, before: cursor });
    expect(result.current.nextSearch).toEqual({ first: 1, after: cursor });
    expect(result.current.search).toEqual({ first: 10 });
    expect(sessionStorage.length).toBe(0);
  });

  it.each([undefined, null])(
    "retains filters and return pagination when saved ordering is %s",
    (orderBy) => {
      const searchSchema = z.object({
        first: z.number().default(10),
        after: z.string().optional(),
        query: z.string().optional(),
        orderBy: z.object({ field: z.string() }).nullish(),
      });
      renderHook(
        () =>
          usePageSearch({
            key: ["id-only"],
            searchSchema,
            search: { first: 5, after: "old", query: "example", orderBy },
          }),
        { wrapper },
      );
      const { result } = renderHook(
        () =>
          usePageNavigation({
            key: ["id-only"],
            searchSchema,
            record: { id: "B" },
          }),
        { wrapper },
      );
      const cursor = btoa(JSON.stringify({ id: "B" }));
      expect(result.current.previousSearch).toEqual({
        query: "example",
        orderBy,
        last: 1,
        before: cursor,
      });
      expect(result.current.nextSearch).toEqual({
        query: "example",
        orderBy,
        first: 1,
        after: cursor,
      });
      expect(result.current.getBackSearch("previous")).toEqual({
        query: "example",
        orderBy,
        first: 5,
        after: "previous",
      });
    },
  );

  it.each([
    { first: 5, after: "old" },
    { last: 5, before: "old" },
  ])("preserves filters and size but replaces pagination: %j", (pagination) => {
    renderHook(
      () =>
        usePageSearch({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          search: { ...conditions, ...pagination },
        }),
      { wrapper },
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
    const cursor = btoa(JSON.stringify({ id: record.id, value: record.id }));
    expect(result.current.previousSearch).toEqual({
      ...conditions,
      last: 1,
      before: cursor,
    });
    expect(result.current.nextSearch).toEqual({
      ...conditions,
      first: 1,
      after: cursor,
    });
    expect(result.current.getBackSearch("previous")).toEqual({
      ...conditions,
      first: 5,
      after: "previous",
    });
    for (const previousCursor of [null, undefined]) {
      expect(result.current.getBackSearch(previousCursor)).toEqual({
        ...conditions,
        first: 5,
        after: undefined,
      });
    }
    // Callers can use the original search while neighbors are unavailable.
    expect(result.current.search).toEqual(
      apiKeySearchSchema.parse({ ...conditions, ...pagination }),
    );
  });

  it("derives the position from live record data, including browser-back and null sort values, without persisting it", () => {
    renderHook(
      () =>
        usePageSearch({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          search: {
            orderBy: {
              field: UserApiKeyOrderField.LAST_USED_AT,
              direction: OrderDirection.DESC,
            },
          },
        }),
      { wrapper },
    );
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

  it("uses schema defaults on direct entry without writing a fake list visit", () => {
    const { result } = renderHook(
      () =>
        usePageNavigation({
          key: pageKey,
          searchSchema: apiKeySearchSchema,
          record,
        }),
      { wrapper },
    );
    expect(result.current.search).toEqual({
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
    expect(result.current.getBackSearch("previous")).toEqual(
      result.current.search,
    );
    expect(result.current.getBackSearch()).toEqual(result.current.search);
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
    expect(result.current.search.orderBy.field).toBe(
      UserApiKeyOrderField.CREATED_AT,
    );
    expect(result.current.search).toMatchObject({ first: 5 });
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
    expect(result.current.nextSearch.orderBy).toEqual({
      field: "NAME",
      direction: OrderDirection.ASC,
    });
    expect(result.current.getBackSearch()).toMatchObject({
      first: 7,
    });
  });
});
