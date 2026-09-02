import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

export async function graphqlRequest<TData = Record<string, unknown>>(
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown> = {},
  headers?: Record<string, string>,
) {
  const response = await request.post("/api/graphql", {
    data: {
      query,
      variables,
    },
    headers,
  });
  const body = (await response.json()) as {
    data?: TData;
    errors?: unknown;
  };

  expect(response.ok()).toBeTruthy();
  expect(body.errors, JSON.stringify(body.errors ?? [])).toBeUndefined();
  expect(body.data).toBeDefined();

  return body.data as TData;
}
