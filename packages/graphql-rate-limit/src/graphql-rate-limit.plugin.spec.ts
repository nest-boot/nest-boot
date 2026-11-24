import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { GraphQLSchemaHost } from "@nest-boot/graphql";
import { ModuleRef } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  buildSchema,
  FieldNode,
  getOperationAST,
  GraphQLResolveInfo,
  Kind,
  parse,
} from "graphql";
import * as graphqlQueryComplexity from "graphql-query-complexity/cjs";

import { OPTIONS_TOKEN } from "./graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitPlugin } from "./graphql-rate-limit.plugin.js";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage.js";
import {
  CostThrottleStatus,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";

const { getComplexity, simpleEstimator } =
  graphqlQueryComplexity as unknown as typeof import("graphql-query-complexity");

// Match Nest and the complexity library's CommonJS GraphQL runtime.
vi.mock("graphql", async () => await vi.importActual("graphql/index.js"));

vi.mock("graphql-query-complexity/cjs", async () => {
  const actual = await vi.importActual<
    typeof import("graphql-query-complexity/cjs")
  >("graphql-query-complexity/cjs");

  return {
    ...actual,
    getComplexity: vi.fn(),
    simpleEstimator: vi.fn(actual.simpleEstimator),
  };
});

interface TestExecutionListener {
  willResolveField(args: {
    args: Record<string, unknown>;
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

    type Query {
      hello: String!
      item: Item
      failedItem: Item
    }

    type Mutation {
      update: UpdateResult!
    }

    type UpdateResult {
      status: String!
      details: Item!
    }
  `);
  const document = parse(/* GraphQL */ `
    query TestQuery {
      hello
      item {
        name
      }
      failedItem {
        name
      }
    }
  `);
  const mutationDocument = parse(/* GraphQL */ `
    query OtherOperation {
      item {
        name
      }
    }

    mutation Update($include: Boolean!) {
      update {
        status
      }
      ...Repeated
      optional: update @include(if: $include) {
        status
      }
    }

    fragment Repeated on Mutation {
      update {
        details {
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
  const subPoint = vi.fn(() => Promise.resolve(available));
  const addPoint = vi.fn(() => Promise.resolve(restored));
  const storage = {
    subPoint,
    addPoint,
  } as unknown as GraphQLRateLimitStorage;
  const schemaHost = { schema } as GraphQLSchemaHost;
  const moduleRef = {
    get: vi.fn(() => schemaHost),
  } as unknown as ModuleRef;
  const options: GraphQLRateLimitOptions = {
    maxComplexity: 1000,
    defaultComplexity: 0,
    keyPrefix: "graphql-rate-limit",
    restoreRate: 5,
    maximumAvailable: 100,
    getId: () => "client",
  };
  const mockedGetComplexity = vi.mocked(getComplexity);
  const mockedSimpleEstimator = vi.mocked(simpleEstimator);
  const createPlugin = (overrides?: Partial<GraphQLRateLimitOptions>) =>
    new GraphQLRateLimitPlugin(storage, moduleRef, {
      ...options,
      ...overrides,
    });
  const mutationContext = (include: boolean | null) =>
    ({
      request: { operationName: "Update", variables: { include } },
      document: mutationDocument,
      operation: getOperationAST(mutationDocument, "Update"),
    }) as unknown as GraphQLRequestContext<BaseContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetComplexity.mockReturnValue(7);
    subPoint.mockResolvedValue(available);
    addPoint.mockResolvedValue(restored);
  });

  it("settles successful fields, refunds unused cost, and reports throttle state", async () => {
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
    const plugin = createPlugin();
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
    for (const fieldName of ["hello", "item", "failedItem"]) {
      const fieldNode = selections.find(
        (selection): selection is FieldNode =>
          selection.kind === Kind.FIELD && selection.name.value === fieldName,
      );
      if (!fieldNode) {
        throw new Error(`Expected ${fieldName} field`);
      }

      const endField = executionListener.willResolveField({
        args: {},
        info: {
          parentType: queryType,
          fieldName,
          fieldNodes: [fieldNode],
        } as unknown as GraphQLResolveInfo,
      });
      endField(fieldName === "failedItem" ? new Error("Item failed") : null);
    }

    await listener.willSendResponse(context);

    expect(subPoint).toHaveBeenCalledWith(context, 7);
    expect(addPoint).toHaveBeenCalledWith(context, 6);
    expect(response.body.singleResult.extensions).toEqual({
      traceId: "request-1",
      cost: {
        requestedQueryCost: 7,
        actualQueryCost: 1,
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
    const plugin = createPlugin();
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Too Many Requests",
    );
  });

  it.each([
    { include: false, cost: 11 },
    { include: true, cost: 21 },
  ])(
    "reserves only the selected mutation fields with include=$include",
    async ({ include, cost }) => {
      const actual = await vi.importActual<
        typeof import("graphql-query-complexity/cjs")
      >("graphql-query-complexity/cjs");
      mockedGetComplexity.mockImplementationOnce(actual.getComplexity);
      const listener =
        (await createPlugin().requestDidStart()) as TestRequestListener;
      const context = mutationContext(include);

      await listener.didResolveOperation(context);

      expect(subPoint).toHaveBeenCalledWith(context, cost);
    },
  );

  it("reserves zero points for an aliased __typename mutation selection", async () => {
    const actual = await vi.importActual<
      typeof import("graphql-query-complexity/cjs")
    >("graphql-query-complexity/cjs");
    mockedGetComplexity.mockImplementationOnce(actual.getComplexity);
    const typeNameDocument = parse("mutation { type: __typename }");
    const context = {
      request: {},
      document: typeNameDocument,
      operation: getOperationAST(typeNameDocument),
    } as unknown as GraphQLRequestContext<BaseContext>;
    const listener = (await createPlugin({
      defaultComplexity: 7,
    }).requestDidStart()) as TestRequestListener;

    await listener.didResolveOperation(context);

    expect(subPoint).toHaveBeenCalledWith(context, 0);
  });

  it("rejects invalid mutation directive variables before reserving any points", async () => {
    const listener =
      (await createPlugin().requestDidStart()) as TestRequestListener;

    await expect(
      listener.didResolveOperation(mutationContext(null)),
    ).rejects.toThrow(
      'Variable "$include" of non-null type "Boolean!" must not be null.',
    );
    expect(subPoint).not.toHaveBeenCalled();
  });

  it("rejects overly complex requests before consuming driver points", async () => {
    mockedGetComplexity.mockReturnValue(1000);
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const plugin = createPlugin();
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Query is too complex: 1000. Maximum allowed complexity: 1000",
    );
    expect(subPoint).not.toHaveBeenCalled();
  });

  it("uses configured complexity options", async () => {
    mockedGetComplexity.mockReturnValue(1);
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const moduleRef = await Test.createTestingModule({
      providers: [
        GraphQLRateLimitPlugin,
        { provide: GraphQLRateLimitStorage, useValue: storage },
        { provide: GraphQLSchemaHost, useValue: schemaHost },
        {
          provide: OPTIONS_TOKEN,
          useValue: {
            ...options,
            maxComplexity: 1,
            defaultComplexity: 7,
          },
        },
      ],
    }).compile();
    const plugin = moduleRef.get(GraphQLRateLimitPlugin);
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    expect(mockedSimpleEstimator).toHaveBeenCalledWith({
      defaultComplexity: 7,
    });
    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Query is too complex: 1. Maximum allowed complexity: 1",
    );
    expect(subPoint).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
