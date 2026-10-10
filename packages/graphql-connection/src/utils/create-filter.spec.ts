import { Kind } from "graphql";

import type {
  ConnectionFieldOptions,
  FieldOptions,
} from "../interfaces/index.js";
import { createFilter } from "./create-filter.js";

interface Book {
  title: string;
  searchableTitle: string;
  rating: number;
  published: boolean;
}

describe("createFilter", () => {
  it("maps $fulltext to a configured fulltext field path", () => {
    const titleField = {
      field: "title",
      type: "string",
      fulltext: "searchableTitle",
    } satisfies FieldOptions<Book, "string", "searchableTitle">;
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", titleField],
    ]);

    const { filterQuerySchema } = createFilter("Book", fieldOptionsMap);

    expect(
      filterQuerySchema.parse({ title: { $fulltext: "search term" } }),
    ).toEqual({
      searchableTitle: { $fulltext: "search term" },
    });
  });

  it("keeps non-fulltext operators on the original field", () => {
    const titleField = {
      field: "title",
      type: "string",
      fulltext: "searchableTitle",
    } satisfies FieldOptions<Book, "string", "searchableTitle">;
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", titleField],
    ]);

    const { filterQuerySchema } = createFilter("Book", fieldOptionsMap);

    expect(
      filterQuerySchema.parse({
        title: { $eq: "exact title", $fulltext: "search term" },
      }),
    ).toEqual({
      title: { $eq: "exact title" },
      searchableTitle: { $fulltext: "search term" },
    });
  });

  it("transforms $between filters through the filter query schema", () => {
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["rating", { field: "rating", type: "number" }],
    ]);

    const { filterQuerySchema } = createFilter("BookBetween", fieldOptionsMap);

    expect(filterQuerySchema.parse({ rating: { $between: [3, 5] } })).toEqual({
      rating: { $gte: 3, $lte: 5 },
    });
  });

  it("parses scalar values from GraphQL literals", () => {
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", { field: "title", type: "string" }],
      ["rating", { field: "rating", type: "number" }],
      ["published", { field: "published", type: "boolean" }],
    ]);

    const { Filter } = createFilter("BookLiteral", fieldOptionsMap);

    expect(
      Filter.parseLiteral({
        kind: Kind.OBJECT,
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "title" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "$in" },
                  value: {
                    kind: Kind.LIST,
                    values: [
                      { kind: Kind.STRING, value: "A" },
                      { kind: Kind.ENUM, value: "B" },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "rating" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "$gte" },
                  value: { kind: Kind.FLOAT, value: "4.5" },
                },
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "$lte" },
                  value: { kind: Kind.INT, value: "5" },
                },
              ],
            },
          },
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "published" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "$eq" },
                  value: { kind: Kind.BOOLEAN, value: true },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      title: { $in: ["A", "B"] },
      rating: { $gte: 4.5, $lte: 5 },
      published: { $eq: true },
    });
  });

  it("reports invalid filter values", () => {
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", { field: "title", type: "string" }],
    ]);

    const { Filter } = createFilter("BookInvalid", fieldOptionsMap);

    expect(() => Filter.parseValue("{")).toThrow(
      "Filter must be a valid JSON string",
    );
    expect(
      Filter.parseLiteral({
        kind: Kind.OBJECT,
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "title" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "$eq" },
                  value: { kind: Kind.NULL },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      title: { $eq: null },
    });
    expect(() =>
      Filter.parseLiteral({
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: "filter" },
      }),
    ).toThrow("Unexpected AST kind: Variable");
    expect(Filter.serialize({ title: { $eq: "GraphQL" } })).toEqual({
      title: { $eq: "GraphQL" },
    });
  });
});
