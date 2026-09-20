import { GraphQLError } from "graphql";

/** Validates pagination before any field can contribute to the operation cost. */
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
      throw new GraphQLError(`${name} must be a non-negative safe integer`, {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  }
  return (args.first ?? args.last ?? fallback) as number;
}
