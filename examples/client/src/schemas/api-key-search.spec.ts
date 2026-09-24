import { describe, expect, it } from "vitest";

import { apiKeySearchSchema } from "./api-key-search";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { OrderDirection } from "@/lib/connection-search";
import { UserApiKeyOrderField } from "@/gql/graphql";

describe("shared API-key search", () => {
  it("uses the same default pagination and ordering in both owner scopes", () => {
    expect(
      createConnectionQueryVariables(apiKeySearchSchema.parse({})),
    ).toEqual({
      first: 20,
      query: "",
      filter: {},
      orderBy: {
        field: UserApiKeyOrderField.CREATED_AT,
        direction: OrderDirection.DESC,
      },
    });
  });

  it("preserves backward pagination, search, filters, and explicit ordering", () => {
    const search = apiKeySearchSchema.parse({
      last: 5,
      before: "cursor",
      query: "automation",
      filter: { prefix: { $eq: "sk" } },
      orderBy: {
        field: UserApiKeyOrderField.CREATED_AT,
        direction: OrderDirection.ASC,
      },
    });
    expect(createConnectionQueryVariables(search)).toEqual({
      last: 5,
      before: "cursor",
      query: "automation",
      filter: { prefix: { $eq: "sk" } },
      orderBy: {
        field: UserApiKeyOrderField.CREATED_AT,
        direction: OrderDirection.ASC,
      },
    });
  });

  it("normalizes invalid page sizes and ignores unsupported filter operators", () => {
    const search = apiKeySearchSchema.parse({
      first: 100,
      filter: { prefix: { $unknown: "sk" } },
    });
    expect(search).toMatchObject({ first: 20 });
    expect(search.filter).toEqual({ prefix: undefined });
  });
});
