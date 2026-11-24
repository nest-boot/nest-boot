import { GraphQLBadUserInputError } from "@nest-boot/graphql";

/**
 * Validates pagination for the explicit connection complexity callback.
 * @param args - Connection arguments containing an optional first or last limit.
 * @param fallback - Page size used when no limit is supplied.
 * @returns Requested connection limit or the fallback page size.
 */
export function connectionPageSize(
  args: Record<string, unknown>,
  fallback: number,
): number {
  for (const name of ["first", "last"] as const) {
    const value = args[name];
    if (
      value != null &&
      (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    ) {
      throw new GraphQLBadUserInputError(
        `${name} must be a non-negative safe integer`,
      );
    }
  }
  return (args.first ?? args.last ?? fallback) as number;
}
