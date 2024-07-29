import type { ExecutionContext } from "@nestjs/common";
import type { GqlContextType, GqlExecutionContext } from "@nestjs/graphql";

import { tryRequire } from "./try-require.util";

const graphql = tryRequire<{ GqlExecutionContext: typeof GqlExecutionContext }>(
  "@nestjs/graphql",
);

export function isResolvingGraphQLField(context: ExecutionContext): boolean {
  if (context.getType<GqlContextType>() === "graphql") {
    if (typeof graphql === "undefined") {
      throw new Error("You need to install the @nestjs/graphql package.");
    }

    const gqlContext = graphql.GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const parentType = info.parentType.name;
    return parentType !== "Query" && parentType !== "Mutation";
  }

  return false;
}
