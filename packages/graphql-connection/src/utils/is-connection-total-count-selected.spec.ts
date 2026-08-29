import { type GraphQLResolveInfo, Kind, parse } from "graphql";

import { isConnectionTotalCountSelected } from "./is-connection-total-count-selected";

function createResolveInfo(
  source: string,
  variableValues: Record<string, unknown> = {},
): GraphQLResolveInfo {
  const document = parse(source);
  const operation = document.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );

  if (operation?.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error("Operation definition not found");
  }

  const fieldNode = operation.selectionSet.selections.find(
    (selection) => selection.kind === Kind.FIELD,
  );

  if (fieldNode?.kind !== Kind.FIELD) {
    throw new Error("Connection field not found");
  }

  return {
    fieldNodes: [fieldNode],
    fragments: Object.fromEntries(
      document.definitions
        .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
        .map((definition) => [definition.name.value, definition]),
    ),
    variableValues,
  } as unknown as GraphQLResolveInfo;
}

describe("isConnectionTotalCountSelected", () => {
  it("detects aliased count fields in named fragments", () => {
    const info = createResolveInfo(`
      query {
        books {
          ...CountFields
        }
      }

      fragment CountFields on BookConnection {
        count: totalCount
      }
    `);

    expect(isConnectionTotalCountSelected(info)).toBe(true);
  });

  it("detects totalCountRelation in inline fragments", () => {
    const info = createResolveInfo(`
      query {
        books {
          ... on BookConnection {
            totalCountRelation
          }
        }
      }
    `);

    expect(isConnectionTotalCountSelected(info)).toBe(true);
  });

  it("visits a repeated named fragment only once", () => {
    const info = createResolveInfo(`
      query {
        books {
          ...EdgeFields
          ...EdgeFields
        }
      }

      fragment EdgeFields on BookConnection {
        edges {
          cursor
        }
      }
    `);

    expect(isConnectionTotalCountSelected(info)).toBe(false);
  });

  it.each([
    ["$skipCount: Boolean!", "@skip(if: $skipCount)", { skipCount: true }],
    [
      "$includeCount: Boolean!",
      "@include(if: $includeCount)",
      { includeCount: false },
    ],
  ])(
    "ignores count fields excluded using %s",
    (variableDefinition, directive, variableValues) => {
      const info = createResolveInfo(
        `
          query(${variableDefinition}) {
            books {
              totalCount ${directive}
            }
          }
        `,
        variableValues,
      );

      expect(isConnectionTotalCountSelected(info)).toBe(false);
    },
  );

  it("returns false when neither count field is selected", () => {
    const info = createResolveInfo(`
      query {
        books {
          edges {
            cursor
          }
        }
      }
    `);

    expect(isConnectionTotalCountSelected(info)).toBe(false);
  });
});
