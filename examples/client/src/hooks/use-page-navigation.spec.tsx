// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageSearch } from "./use-page-search";
import { usePageNavigation } from "./use-page-navigation";
import type { ReactNode } from "react";
import { CurrentUserProvider } from "@/app/_authenticated/contexts/current-user-context";
import { apiKeySearchSchema, createApiKeyCursor } from "@/lib/api-key-search";
import { UserApiKeyOrderField } from "@/gql/graphql";
import { OrderDirection } from "@/lib/connection-search";

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
          getCursor: createApiKeyCursor,
        }),
      { wrapper },
    );
    const cursor = createApiKeyCursor(
      record,
      apiKeySearchSchema.parse(conditions),
    );
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
    expect(result.current.getReturnSearch("previous")).toEqual({
      ...conditions,
      first: 5,
      after: "previous",
    });
    expect(result.current.getReturnSearch(null)).toEqual({
      ...conditions,
      first: 5,
      after: undefined,
    });
    expect(result.current.getReturnSearch(undefined)).toEqual(
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
          getCursor: createApiKeyCursor,
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
          getCursor: createApiKeyCursor,
        }),
      { wrapper },
    );
    expect(result.current.search).toEqual({ first: 20 });
    expect(JSON.parse(atob(result.current.currentCursor))).toEqual({
      id: record.id,
      value: record.createdAt,
    });
    expect(sessionStorage.length).toBe(0);
  });
});
