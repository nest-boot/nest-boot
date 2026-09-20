import { CombinedGraphQLErrors } from "@apollo/client";
import { GraphQLError } from "graphql";
import { describe, expect, it } from "vitest";

import { isAccessDenied } from "./auth-errors";

describe("authorization redirects", () => {
  it.each(["UNAUTHENTICATED", "UNAUTHORIZED", "FORBIDDEN"])(
    "recognizes %s without swallowing other failures",
    (code) => {
      expect(
        isAccessDenied(
          new CombinedGraphQLErrors({
            errors: [new GraphQLError("Denied", { extensions: { code } })],
          }),
        ),
      ).toBe(true);
    },
  );

  it("leaves network, server, and mixed GraphQL errors to the route error boundary", () => {
    expect(isAccessDenied(new Error("Network unavailable"))).toBe(false);
    expect(
      isAccessDenied(
        new CombinedGraphQLErrors({
          errors: [
            new GraphQLError("Denied", { extensions: { code: "FORBIDDEN" } }),
            new GraphQLError("Storage unavailable", {
              extensions: { code: "INTERNAL_SERVER_ERROR" },
            }),
          ],
        }),
      ),
    ).toBe(false);
  });
});
