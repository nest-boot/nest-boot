import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { Logger } from "@nest-boot/logger";

import { GraphQLLoggerPlugin } from "./graphql-logger.plugin.js";

interface TestRequestListener {
  didResolveOperation(
    context: GraphQLRequestContext<BaseContext>,
  ): Promise<void>;
}

describe("GraphQLLoggerPlugin", () => {
  it("assigns resolved operation metadata to the request logger", async () => {
    const assign = vi.fn();
    const plugin = new GraphQLLoggerPlugin({ assign } as unknown as Logger);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;
    const context = {
      operation: { operation: "query" },
      operationName: "CurrentUser",
      queryHash: "query-hash",
    } as unknown as GraphQLRequestContext<BaseContext>;

    await listener.didResolveOperation(context);

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith({
      operation: {
        id: "query-hash",
        name: "CurrentUser",
        type: "query",
      },
    });
  });

  it("preserves absent optional operation metadata", async () => {
    const assign = vi.fn();
    const plugin = new GraphQLLoggerPlugin({ assign } as unknown as Logger);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;
    const context = {
      queryHash: "anonymous-query-hash",
    } as unknown as GraphQLRequestContext<BaseContext>;

    await listener.didResolveOperation(context);

    expect(assign).toHaveBeenCalledWith({
      operation: {
        id: "anonymous-query-hash",
        name: undefined,
        type: undefined,
      },
    });
  });
});
