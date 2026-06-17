import "reflect-metadata";

import { LazyMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage";
import { TypeMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage";
import { Kind } from "graphql";

import { ConnectionBuilder } from "./connection.builder";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants";
import type { ConnectionMetadata } from "./interfaces";
import { PageInfo } from "./objects";

interface BuilderBook {
  id: number;
  title: string;
  searchableTitle: string;
  author: {
    name: string;
  };
  publishedAt: Date;
}

class BuilderBookEntity implements BuilderBook {
  id!: number;

  title!: string;

  searchableTitle!: string;

  author!: { name: string };

  publishedAt!: Date;
}

function fieldNamesAndInvokeTypeFns(
  metadata:
    | { properties?: { name: string; typeFn?: () => unknown }[] }
    | undefined,
) {
  expect(metadata).toBeDefined();

  return metadata?.properties?.map((field) => {
    field.typeFn?.();
    return field.name;
  });
}

describe("ConnectionBuilder", () => {
  it("builds connection types with ordering metadata and filter parsing", () => {
    const result = new ConnectionBuilder(BuilderBookEntity, {
      filter: {
        maxDepth: 2,
        maxConditions: 20,
        maxOrBranches: 5,
        maxArrayLength: 100,
      },
    })
      .addField({
        field: "title",
        type: "string",
        filterable: true,
        sortable: true,
        searchable: true,
        fulltext: "searchableTitle",
      })
      .addField({
        field: "authorName",
        type: "string",
        replacement: "author.name",
        filterable: true,
        sortable: true,
      })
      .addField({
        field: "publishedAt",
        type: "date",
        filterable: false,
        sortable: true,
      })
      .build();

    expect(result.BuilderBookEntityConnection).toBe(result.Connection);
    expect(result.BuilderBookEntityConnectionArgs).toBe(result.ConnectionArgs);
    expect(result.BuilderBookEntityEdge).toBe(result.Edge);
    expect(result.BuilderBookEntityFilter).toBe(result.Filter);
    expect(result.BuilderBookEntityOrder).toBe(result.Order);
    expect(result.BuilderBookEntityOrderField).toBe(result.OrderField);
    expect(result.OrderField).toEqual({
      ID: "id",
      TITLE: "title",
      AUTHOR_NAME: "author.name",
      PUBLISHED_AT: "publishedAt",
    });

    const metadata = Reflect.getMetadata(
      GRAPHQL_CONNECTION_METADATA,
      result.Connection,
    ) as ConnectionMetadata<BuilderBook>;

    expect(metadata.entityClass).toBe(BuilderBookEntity);
    expect([...metadata.fieldOptionsMap.keys()]).toEqual([
      "title",
      "authorName",
      "publishedAt",
    ]);
    expect(
      result.filterQuerySchema.parse({
        title: { $fulltext: "search term" },
      }),
    ).toEqual({
      searchableTitle: { $fulltext: "search term" },
    });
    expect(
      result.Filter.parseValue(JSON.stringify({ authorName: { $eq: "Ada" } })),
    ).toEqual({
      author: { name: { $eq: "Ada" } },
    });
    expect(
      result.Filter.parseLiteral({
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
                  value: { kind: Kind.STRING, value: "GraphQL" },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      title: { $eq: "GraphQL" },
    });

    LazyMetadataStorage.load();
    TypeMetadataStorage.compile();

    expect(
      fieldNamesAndInvokeTypeFns(
        TypeMetadataStorage.getObjectTypeMetadataByTarget(result.Connection),
      ),
    ).toEqual(["edges", "pageInfo", "totalCount"]);
    expect(
      fieldNamesAndInvokeTypeFns(
        TypeMetadataStorage.getObjectTypeMetadataByTarget(result.Edge),
      ),
    ).toEqual(["node", "cursor"]);
    expect(
      fieldNamesAndInvokeTypeFns(
        TypeMetadataStorage.getObjectTypeMetadataByTarget(PageInfo),
      ),
    ).toEqual(["hasNextPage", "hasPreviousPage", "startCursor", "endCursor"]);
    expect(
      fieldNamesAndInvokeTypeFns(
        TypeMetadataStorage.getArgumentsMetadataByTarget(result.ConnectionArgs),
      ),
    ).toEqual([
      "query",
      "filter",
      "first",
      "last",
      "after",
      "before",
      "orderBy",
    ]);
    expect(
      fieldNamesAndInvokeTypeFns(
        TypeMetadataStorage.getInputTypeMetadataByTarget(result.Order),
      ),
    ).toEqual(["field", "direction"]);
  });
});
