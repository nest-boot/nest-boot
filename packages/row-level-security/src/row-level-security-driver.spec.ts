import { PostgreSqlConnection } from "@mikro-orm/postgresql";
import { RequestContext } from "@nest-boot/request-context";

import { RowLevelSecurity, RowLevelSecurityMode } from "./row-level-security";
import { RowLevelSecurityConnection } from "./row-level-security-driver";

describe("RowLevelSecurityDriver", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("delegates unchanged outside RequestContext by default", async () => {
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn();
    const connection = createConnection({ transactional });

    const result = await RowLevelSecurityConnection.prototype.execute.call(
      connection,
      "select original",
      [],
      "all",
    );

    expect(result).toBe("query-result");
    expect(transactional).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      "select original",
      [],
      "all",
      undefined,
      undefined,
    );
  });

  it("delegates unchanged inside RequestContext when no row level security context is set", async () => {
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn();
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "job" }),
      async () => {
        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          "select original",
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      "select original",
      [],
      "all",
      undefined,
      undefined,
    );
  });

  it("delegates unchanged when row level security mode is disabled", async () => {
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn();
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "job" }),
      async () => {
        RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
        RowLevelSecurity.setRole("authenticated");
        RowLevelSecurity.setContext("tenant_id", 7);

        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          "select original",
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      "select original",
      [],
      "all",
      undefined,
      undefined,
    );
  });

  it("applies anonymous row level security when mode is enabled without context values", async () => {
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transaction = {};
    const transactional = jest.fn(async (cb: (trx: unknown) => unknown) => {
      return await cb(transaction);
    });
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "http" }),
      async () => {
        RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);

        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          "select original",
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "SET LOCAL ROLE anonymous;",
      [],
      "run",
      transaction,
      undefined,
    );
  });

  it("applies row level security on an existing transaction before executing the query", async () => {
    const transaction = {};
    const loggerContext = { label: "test" };
    const executeSpy = mockPostgreSqlExecute("query-result");

    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("app_authenticated");
        RowLevelSecurity.setContext("tenant_id", 42);
        RowLevelSecurity.setContext("request_id", "abc");

        return await RowLevelSecurityConnection.prototype.execute.call(
          createConnection(),
          "select original",
          ["value"],
          "all",
          transaction,
          loggerContext,
        );
      },
    );

    expect(result).toBe("query-result");
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "SET LOCAL ROLE app_authenticated;\nSELECT set_config('app.tenant_id', '42', true),set_config('app.request_id', 'abc', true);",
      [],
      "run",
      transaction,
      loggerContext,
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      "select original",
      ["value"],
      "all",
      transaction,
      loggerContext,
    );
  });

  it("opens a short transaction when executing a query outside an existing transaction", async () => {
    const transaction = {};
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn(async (cb: (trx: unknown) => unknown) => {
      return await cb(transaction);
    });
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");
        RowLevelSecurity.setContext("tenant_id", 7);

        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          "select original",
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "SET LOCAL ROLE authenticated;\nSELECT set_config('app.tenant_id', '7', true);",
      [],
      "run",
      transaction,
      undefined,
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      "select original",
      [],
      "all",
      transaction,
      undefined,
    );
  });

  it("reuses the transaction from a transacting Knex query builder", async () => {
    const queryBuilder = {
      client: {
        transacting: true,
      },
    };
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn();
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");

        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          queryBuilder as any,
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "SET LOCAL ROLE authenticated;",
      [],
      "run",
      queryBuilder,
      undefined,
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      queryBuilder,
      [],
      "all",
      queryBuilder,
      undefined,
    );
  });

  it("opens a short transaction for a Knex query builder without a transaction", async () => {
    const queryBuilder = {
      client: {
        transacting: false,
      },
    };
    const transaction = {};
    const executeSpy = mockPostgreSqlExecute("query-result");
    const transactional = jest.fn(async (cb: (trx: unknown) => unknown) => {
      return await cb(transaction);
    });
    const connection = createConnection({ transactional });

    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");

        return await RowLevelSecurityConnection.prototype.execute.call(
          connection,
          queryBuilder as any,
          [],
          "all",
        );
      },
    );

    expect(result).toBe("query-result");
    expect(transactional).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "SET LOCAL ROLE authenticated;",
      [],
      "run",
      transaction,
      undefined,
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      queryBuilder,
      [],
      "all",
      transaction,
      undefined,
    );
  });

  it("reuses row level security setup on the same transaction until the context changes", async () => {
    const transaction = {};
    const executeSpy = mockPostgreSqlExecute("query-result");

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setRole("authenticated");
      RowLevelSecurity.setContext("tenant_id", 1);

      await RowLevelSecurityConnection.prototype.execute.call(
        createConnection(),
        "select one",
        [],
        "all",
        transaction,
      );
      await RowLevelSecurityConnection.prototype.execute.call(
        createConnection(),
        "select two",
        [],
        "all",
        transaction,
      );

      RowLevelSecurity.setContext("tenant_id", 2);

      await RowLevelSecurityConnection.prototype.execute.call(
        createConnection(),
        "select three",
        [],
        "all",
        transaction,
      );
    });

    const rlsQueries = executeSpy.mock.calls.filter(
      ([query]) =>
        typeof query === "string" && query.startsWith("SET LOCAL ROLE"),
    );
    expect(rlsQueries).toHaveLength(2);
    expect(rlsQueries[0]?.[0]).toBe(
      "SET LOCAL ROLE authenticated;\nSELECT set_config('app.tenant_id', '1', true);",
    );
    expect(rlsQueries[1]?.[0]).toBe(
      "SET LOCAL ROLE authenticated;\nSELECT set_config('app.tenant_id', '2', true);",
    );
  });
});

function mockPostgreSqlExecute(result: unknown) {
  return jest
    .spyOn(PostgreSqlConnection.prototype, "execute")
    .mockImplementation(async (queryOrKnex) => {
      return typeof queryOrKnex === "string" &&
        queryOrKnex.startsWith("SET LOCAL ROLE")
        ? (undefined as any)
        : (result as any);
    });
}

function createConnection(overrides: Record<string, unknown> = {}) {
  return Object.assign(
    Object.create(RowLevelSecurityConnection.prototype),
    overrides,
  ) as RowLevelSecurityConnection;
}
