import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { GraphQLSchemaHost } from "@nest-boot/graphql";
import {
  buildSchema,
  FieldNode,
  GraphQLResolveInfo,
  Kind,
  parse,
} from "graphql";
import { getComplexity } from "graphql-query-complexity";

import { GraphQLRateLimitPlugin } from "../src/graphql-rate-limit.plugin";
import { GraphQLRateLimitStorage } from "../src/graphql-rate-limit.storage";
import { CostThrottleStatus } from "../src/interfaces";

jest.mock("graphql-query-complexity", () => ({
  ...jest.requireActual<typeof import("graphql-query-complexity")>(
    "graphql-query-complexity",
  ),
  getComplexity: jest.fn(),
}));

interface TestExecutionListener {
  willResolveField(args: {
    info: GraphQLResolveInfo;
  }): (error: Error | null) => void;
}

interface TestRequestListener {
  didResolveOperation(args: GraphQLRequestContext<BaseContext>): Promise<void>;
  executionDidStart(): Promise<TestExecutionListener>;
  willSendResponse(args: GraphQLRequestContext<BaseContext>): Promise<void>;
}

describe("GraphQLRateLimitPlugin", () => {
  const schema = buildSchema(/* GraphQL */ `
    type Item {
      name: String
    }

    type ItemConnection {
      nodes: [Item!]!
    }

    type Query {
      hello: String!
      item: Item
      connection(first: Int): ItemConnection
    }
  `);
  const document = parse(/* GraphQL */ `
    query TestQuery {
      hello
      item {
        name
      }
      connection(first: 2) {
        nodes {
          name
        }
      }
    }
  `);
  const available: CostThrottleStatus = {
    blocked: false,
    maximumAvailable: 100,
    currentlyAvailable: 93,
    restoreRate: 5,
  };
  const restored: CostThrottleStatus = {
    ...available,
    currentlyAvailable: 97,
  };
  const subPoint = jest.fn(() => Promise.resolve(available));
  const addPoint = jest.fn(() => Promise.resolve(restored));
  const storage = {
    subPoint,
    addPoint,
  } as unknown as GraphQLRateLimitStorage;
  const schemaHost = { schema } as GraphQLSchemaHost;
  const mockedGetComplexity = jest.mocked(getComplexity);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetComplexity.mockReturnValue(7);
    subPoint.mockResolvedValue(available);
    addPoint.mockResolvedValue(restored);
  });

  it("charges requested cost, refunds unused cost, and reports throttle state", async () => {
    const response = {
      body: {
        kind: "single" as const,
        singleResult: {
          data: { hello: "world" },
          extensions: { traceId: "request-1" },
        },
      },
    };
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
      response,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const plugin = new GraphQLRateLimitPlugin(storage, schemaHost);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await listener.didResolveOperation(context);

    const executionListener = await listener.executionDidStart();
    const queryType = schema.getQueryType();
    if (!queryType) {
      throw new Error("Expected a query type");
    }

    const selections =
      document.definitions[0].kind === Kind.OPERATION_DEFINITION
        ? document.definitions[0].selectionSet.selections
        : [];
    for (const fieldName of ["hello", "item", "connection"]) {
      const fieldNode = selections.find(
        (selection): selection is FieldNode =>
          selection.kind === Kind.FIELD && selection.name.value === fieldName,
      );
      if (!fieldNode) {
        throw new Error(`Expected ${fieldName} field`);
      }

      const endField = executionListener.willResolveField({
        info: {
          parentType: queryType,
          fieldName,
          fieldNodes: [fieldNode],
        } as unknown as GraphQLResolveInfo,
      });
      endField(null);
    }

    await listener.willSendResponse(context);

    expect(subPoint).toHaveBeenCalledWith(context, 7);
    expect(addPoint).toHaveBeenCalledWith(context, 4);
    expect(response.body.singleResult.extensions).toEqual({
      traceId: "request-1",
      cost: {
        requestedQueryCost: 7,
        actualQueryCost: 3,
        throttleStatus: restored,
      },
    });
  });

  it("rejects a request when the selected driver reports it as blocked", async () => {
    subPoint.mockResolvedValue({ ...available, blocked: true });
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const plugin = new GraphQLRateLimitPlugin(storage, schemaHost);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Too Many Requests",
    );
  });

  it("rejects overly complex requests before consuming driver points", async () => {
    mockedGetComplexity.mockReturnValue(1000);
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const plugin = new GraphQLRateLimitPlugin(storage, schemaHost);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Query is too complex: 1000. Maximum allowed complexity: 1000",
    );
    expect(subPoint).not.toHaveBeenCalled();
  });
});
