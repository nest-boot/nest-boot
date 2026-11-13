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

  it("tokenizes full-text input through the shared schema and both scalar parsers", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      [
        "title",
        { field: "title", type: "string", fulltext: "searchableTitle" },
      ],
    ]);
    const { Filter, filterQuerySchema } = createFilter("BookTokenized", fields);
    const input = {
      title: { $eq: "Original TITLE!", $fulltext: "你好世界 HELLO!" },
    };
    const expected = {
      title: { $eq: "Original TITLE!" },
      searchableTitle: { $fulltext: "你好 世界 hello" },
    };

    expect(filterQuerySchema.parse(input)).toEqual(expected);
    expect(Filter.parseValue(input)).toEqual(expected);
    expect(Filter.parseValue(JSON.stringify(input))).toEqual(expected);
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
                  name: { kind: Kind.NAME, value: "$fulltext" },
                  value: { kind: Kind.STRING, value: "你好世界 HELLO!" },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual({ searchableTitle: { $fulltext: "你好 世界 hello" } });
    expect(input.title.$fulltext).toBe("你好世界 HELLO!");
  });

  it("tokenizes direct full-text fields within logical groups and preserves tokenless conditions", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", { field: "title", type: "string", fulltext: true }],
    ]);
    const { filterQuerySchema } = createFilter("BookFullTextGroups", fields);
    expect(
      filterQuerySchema.parse({
        $or: [
          { title: { $fulltext: "你好世界" } },
          { $not: { title: { $fulltext: "GOODBYE!" } } },
        ],
      }),
    ).toEqual({
      $or: [
        { title: { $fulltext: "你好 世界" } },
        { $not: { title: { $fulltext: "goodbye" } } },
      ],
    });
    expect(filterQuerySchema.parse({ title: { $fulltext: "!!!  " } })).toEqual({
      title: { $fulltext: "" },
    });
  });

  it("passes tokenized full-text input to replacement callbacks", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      [
        "title",
        {
          field: "title",
          type: "string",
          fulltext: true,
          replacement: ({ operator, value }) => ({
            searchableTitle: { [operator]: value },
          }),
        },
      ],
    ]);
    const { filterQuerySchema } = createFilter("BookFullTextCallback", fields);
    expect(
      filterQuerySchema.parse({ title: { $fulltext: "你好世界 HELLO!" } }),
    ).toEqual({
      searchableTitle: { $fulltext: "你好 世界 hello" },
    });
  });

  it("preserves configured operator transforms alongside default full-text tokenization", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      [
        "title",
        { field: "title", type: "string", fulltext: "searchableTitle" },
      ],
    ]);
    const { filterQuerySchema } = createFilter(
      "BookOperatorTransforms",
      fields,
      {
        maxDepth: 5,
        maxConditions: 20,
        maxOrBranches: 5,
        maxArrayLength: 100,
        operatorTransforms: {
          $eq: (value) => (typeof value === "string" ? value.trim() : value),
        },
      },
    );
    expect(
      filterQuerySchema.parse({
        title: { $eq: "  Exact Title!  ", $fulltext: "你好世界 HELLO!" },
      }),
    ).toEqual({
      title: { $eq: "Exact Title!" },
      searchableTitle: { $fulltext: "你好 世界 hello" },
    });
  });

  it("allows explicitly configured full-text transforms to override the default", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      [
        "title",
        { field: "title", type: "string", fulltext: "searchableTitle" },
      ],
    ]);
    const { filterQuerySchema } = createFilter("BookCustomFullText", fields, {
      maxDepth: 5,
      maxConditions: 20,
      maxOrBranches: 5,
      maxArrayLength: 100,
      operatorTransforms: { $fulltext: (value) => value.trim() },
    });
    expect(
      filterQuerySchema.parse({ title: { $fulltext: "  Custom TERMS!  " } }),
    ).toEqual({
      searchableTitle: { $fulltext: "Custom TERMS!" },
    });
  });

  it("leaves query fragments produced by replacement callbacks unchanged", () => {
    const fields = new Map<string, ConnectionFieldOptions<Book>>([
      [
        "title",
        {
          field: "title",
          type: "string",
          replacement: () => ({
            searchableTitle: { $fulltext: "KEEP Original!" },
          }),
        },
      ],
    ]);
    const { filterQuerySchema } = createFilter("BookCallbackFragment", fields);
    expect(filterQuerySchema.parse({ title: "input" })).toEqual({
      searchableTitle: { $fulltext: "KEEP Original!" },
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
