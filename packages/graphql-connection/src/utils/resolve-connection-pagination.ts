import { PagingType } from "../enums/paging-type.enum.js";
import { MAX_CONNECTION_PAGE_SIZE } from "../graphql-connection.constants.js";
import type { ConnectionArgsInterface } from "../interfaces/index.js";

/**
 * Validates and resolves the pagination arguments for a connection.
 * @param args - Page size and cursor arguments.
 * @returns The requested page size and pagination direction or a validation error message.
 */
export function resolveConnectionPagination(
  args: Pick<
    ConnectionArgsInterface<object>,
    "first" | "last" | "after" | "before"
  >,
): { limit: number; pagingType: PagingType } | { error: string } {
  const { first, last, after, before } = args;
  for (const [name, value] of [
    ["first", first],
    ["last", last],
  ] as const) {
    if (
      value != null &&
      (!Number.isInteger(value) ||
        value < 1 ||
        value > MAX_CONNECTION_PAGE_SIZE)
    ) {
      return {
        error: `${name} must be an integer between 1 and ${String(MAX_CONNECTION_PAGE_SIZE)}`,
      };
    }
  }

  const limit = first ?? last;
  if (limit == null || (first != null && last != null)) {
    return { error: "Provide exactly one of first or last" };
  }

  const forward = first != null;
  if (forward ? before != null : after != null) {
    return { error: "Use after with first and before with last" };
  }

  return {
    limit,
    pagingType: forward ? PagingType.FORWARD : PagingType.BACKWARD,
  };
}
