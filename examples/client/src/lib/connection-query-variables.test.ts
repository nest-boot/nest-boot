import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import z from "zod";

import { createConnectionQueryVariables } from "./connection-query-variables";
import {
  OrderDirection,
  createCheckboxFilterItemSearchSchema,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
  createNumberFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
} from "./connection-search";

const start = "2026-09-01T00:00:00.000Z";
const end = "2026-09-23T00:00:00.000Z";

describe("connection query filters", () => {
  it("passes all field types from parsed search to GraphQL variables", () => {
    const schema = createConnectionSearchSchema({
      pageSize: 20,
      orderField: { ID: "ID" },
      defaultOrderField: "ID",
      defaultOrderDirection: OrderDirection.DESC,
      filterSchema: createFilterSchema({
        name: createInputFilterItemSearchSchema(undefined, { fulltext: true }),
        status: createSelectFilterItemSearchSchema(z.enum(["ACTIVE"])),
        count: createNumberFilterItemSearchSchema(),
        enabled: createCheckboxFilterItemSearchSchema(),
        created_at: createDateFilterItemSearchSchema(),
      }),
    });
    const filter = {
      name: { $fulltext: "name" },
      status: { $in: ["ACTIVE"] },
      count: { $between: [0, 10] },
      enabled: false,
      created_at: { $between: [start, end] },
    };
    const search = schema.parse({
      first: 5,
      after: "cursor",
      query: "term",
      filter,
    });
    expect(createConnectionQueryVariables(search)).toEqual({
      ...search,
      filter: {
        ...filter,
        created_at: {
          $between: [start, dayjs(end).endOf("day").toISOString()],
        },
      },
    });
  });

  it("keeps every operator when formatting compound conditions", () => {
    expect(
      createConnectionQueryVariables({
        filter: {
          createdAt: { $gte: start, $lte: end },
          count: { $gte: 0, $lt: 10 },
          name: { $eq: "exact", $fulltext: "term" },
        },
      }).filter,
    ).toEqual({
      createdAt: { $gte: start, $lte: dayjs(end).endOf("day").toISOString() },
      count: { $gte: 0, $lt: 10 },
      name: { $eq: "exact", $fulltext: "term" },
    });
  });

  it("preserves null equality, false and zero", () => {
    const filter = {
      created_at: { $eq: null },
      createdAt: { $ne: null },
      enabled: { $eq: false },
      count: { $eq: 0 },
    };
    expect(createConnectionQueryVariables({ filter }).filter).toEqual(filter);
  });
});
