import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { GraphQLSchemaHost } from "@nest-boot/graphql";
import { ModuleRef } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  buildSchema,
  FieldNode,
  getOperationAST,
  GraphQLError,
  GraphQLResolveInfo,
  Kind,
  parse,
} from "graphql/index.js";
import { getComplexity, simpleEstimator } from "graphql-query-complexity";

import { OPTIONS_TOKEN } from "./graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitPlugin } from "./graphql-rate-limit.plugin.js";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage.js";
import {
  CostThrottleStatus,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";

vi.mock("graphql-query-complexity", async () => {
  const actual = await vi.importActual<
    typeof import("graphql-query-complexity")
  >("graphql-query-complexity");

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

    input SkillOwnerInput {
      type: String!
    }

    input CreateSkillInput {
      owner: SkillOwnerInput!
    }

    type Mutation {
      update: UpdateResult!
      createSkill(input: CreateSkillInput!): ID!
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
        typeof import("graphql-query-complexity")
      >("graphql-query-complexity");
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
      typeof import("graphql-query-complexity")
    >("graphql-query-complexity");
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
    ).rejects.toMatchObject({
      message:
        'Variable "$include" of non-null type "Boolean!" must not be null.',
      extensions: {
        code: "BAD_USER_INPUT",
        http: { status: 400 },
      },
    });
    expect(subPoint).not.toHaveBeenCalled();
  });

  it("classifies missing required input fields as BAD_USER_INPUT with HTTP 400", async () => {
    const actual = await vi.importActual<
      typeof import("graphql-query-complexity")
    >("graphql-query-complexity");
    mockedGetComplexity.mockImplementationOnce(actual.getComplexity);
    const createSkillDocument = parse(
      "mutation CreateSkill($input: CreateSkillInput!) { createSkill(input: $input) }",
    );
    const context = {
      request: {
        operationName: "CreateSkill",
        variables: { input: {} },
      },
      document: createSkillDocument,
      operation: getOperationAST(createSkillDocument, "CreateSkill"),
    } as unknown as GraphQLRequestContext<BaseContext>;
    const listener =
      (await createPlugin().requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toMatchObject({
      message:
        'Variable "$input" got invalid value {}; Field "owner" of required type "SkillOwnerInput!" was not provided.',
      locations: [{ line: 1, column: 22 }],
      extensions: {
        code: "BAD_USER_INPUT",
        http: { status: 400 },
      },
    });
    expect(subPoint).not.toHaveBeenCalled();
  });

  it("preserves explicit error extensions on variable coercion errors and ignores unrelated errors", async () => {
    const listener =
      (await createPlugin().requestDidStart()) as TestRequestListener;
    const operation = getOperationAST(mutationDocument, "Update");
    const variableNode = operation?.variableDefinitions?.[0];
    if (!variableNode) {
      throw new Error("Expected variable definition");
    }

    const customCoercionError = new GraphQLError(
      'Variable "$include" has invalid value "forbidden".',
      {
        nodes: [variableNode],
        extensions: {
          code: "FORBIDDEN",
          http: { status: 403 },
        },
      },
    );
    mockedGetComplexity.mockImplementationOnce(() => {
      throw customCoercionError;
    });
    await expect(
      listener.didResolveOperation({
        request: { operationName: "TestQuery", variables: {} },
        document,
      } as unknown as GraphQLRequestContext<BaseContext>),
    ).rejects.toMatchObject({
      message: 'Variable "$include" has invalid value "forbidden".',
      extensions: {
        code: "FORBIDDEN",
        http: { status: 403 },
      },
    });

    for (const unrelatedError of [
      new Error("Estimator crashed"),
      new GraphQLError("No complexity calculated"),
      new GraphQLError("Unrelated field error", { nodes: [operation] }),
      new GraphQLError("Unrelated variable error", { nodes: [variableNode] }),
    ]) {
      mockedGetComplexity.mockImplementationOnce(() => {
        throw unrelatedError;
      });
      await expect(
        listener.didResolveOperation({
          request: { operationName: "TestQuery", variables: {} },
          document,
        } as unknown as GraphQLRequestContext<BaseContext>),
      ).rejects.toBe(unrelatedError);
    }

    expect(subPoint).not.toHaveBeenCalled();
  });

  it("rejects overly complex requests before consuming driver points", async () => {
    mockedGetComplexity.mockReturnValue(1001);
    const context = {
      request: { operationName: "TestQuery", variables: {} },
      document,
    } as unknown as GraphQLRequestContext<BaseContext>;
    const plugin = createPlugin();
    const listener = (await plugin.requestDidStart()) as TestRequestListener;

    await expect(listener.didResolveOperation(context)).rejects.toThrow(
      "Query is too complex: 1001. Maximum allowed complexity: 1000",
    );
    expect(subPoint).not.toHaveBeenCalled();
  });

  it("uses configured complexity options", async () => {
    mockedGetComplexity.mockReturnValue(2);
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
      "Query is too complex: 2. Maximum allowed complexity: 1",
    );
    expect(subPoint).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
