import {
  getDirectiveValues,
  GraphQLIncludeDirective,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  Kind,
  type SelectionNode,
  type SelectionSetNode,
} from "graphql";

const TOTAL_COUNT_FIELDS = new Set(["totalCount", "totalCountRelation"]);

function shouldIncludeNode(
  info: GraphQLResolveInfo,
  node: SelectionNode,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    info.variableValues,
  );

  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    info.variableValues,
  );

  return include?.if !== false;
}

/**
 * Determines whether a connection count field is selected by a GraphQL
 * operation.
 *
 * @internal
 */
export function isConnectionTotalCountSelected(
  info: GraphQLResolveInfo,
): boolean {
  const visitedFragments = new Set<string>();

  const visitSelectionSet = (selectionSet: SelectionSetNode): boolean =>
    selectionSet.selections.some((selection) => {
      if (!shouldIncludeNode(info, selection)) {
        return false;
      }

      switch (selection.kind) {
        case Kind.FIELD:
          return TOTAL_COUNT_FIELDS.has(selection.name.value);

        case Kind.INLINE_FRAGMENT:
          return visitSelectionSet(selection.selectionSet);

        case Kind.FRAGMENT_SPREAD: {
          const fragmentName = selection.name.value;

          if (visitedFragments.has(fragmentName)) {
            return false;
          }

          visitedFragments.add(fragmentName);
          const fragment = info.fragments[fragmentName];

          return (
            typeof fragment !== "undefined" &&
            visitSelectionSet(fragment.selectionSet)
          );
        }
      }
    });

  return info.fieldNodes.some(
    (fieldNode) =>
      typeof fieldNode.selectionSet !== "undefined" &&
      visitSelectionSet(fieldNode.selectionSet),
  );
}
