import { PagingType } from "../enums/paging-type.enum.js";
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
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      return { error: `${name} must be a non-negative safe integer` };
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
