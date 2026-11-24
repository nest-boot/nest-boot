import { GraphQLError } from "graphql";

import { PagingType } from "../enums/paging-type.enum.js";
import type { ConnectionArgsInterface } from "../interfaces/index.js";

/**
 * Validates and resolves the pagination arguments for a connection.
 * @param args - Page size and cursor arguments.
 * @returns The requested page size and pagination direction.
 */
export function resolveConnectionPagination(
  args: Pick<
    ConnectionArgsInterface<object>,
    "first" | "last" | "after" | "before"
  >,
): { limit: number; pagingType: PagingType } {
  const { first, last, after, before } = args;
  const extensions = { code: "BAD_USER_INPUT", http: { status: 400 } };
  for (const [name, value] of [
    ["first", first],
    ["last", last],
  ] as const) {
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      throw new GraphQLError(`${name} must be a non-negative safe integer`, {
        extensions,
      });
    }
  }

  const limit = first ?? last;
  if (limit == null || (first != null && last != null)) {
    throw new GraphQLError("Provide exactly one of first or last", {
      extensions,
    });
  }

  const forward = first != null;
  if (forward ? before != null : after != null) {
    throw new GraphQLError("Use after with first and before with last", {
      extensions,
    });
  }

  return {
    limit,
    pagingType: forward ? PagingType.FORWARD : PagingType.BACKWARD,
  };
}
