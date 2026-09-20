import { CombinedGraphQLErrors } from "@apollo/client";

/** Only known authorization failures may be converted into navigation redirects. */
export function isAccessDenied(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.length > 0 &&
    error.errors.every(({ extensions }) =>
      ["UNAUTHENTICATED", "UNAUTHORIZED", "FORBIDDEN"].includes(
        String(extensions?.code),
      ),
    )
  );
}
