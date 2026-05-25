import { EntityManager } from "@mikro-orm/postgresql";
import { RequestContext } from "@nest-boot/request-context";

import { RowLevelSecurityContext } from "./row-level-security-context";
import { RowLevelSecurityEntityManager } from "./row-level-security-entity-manager";
import { setRowLevelSecurityOptions } from "./utils/set-row-level-security-options";

describe("RowLevelSecurityEntityManager", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setRowLevelSecurityOptions();
  });

  it("sets authenticated row level security transaction context", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    const result = await RequestContext.run(
      new RequestContext({ type: "http" }),
      async () => {
        setRowLevelSecurityOptions({
          authenticatedRole: "app_authenticated",
          isAuthenticated: () => true,
          getContext: () => [["tenant_id", "42"]],
        });

        return await callTransactional();
      },
    );

    expect(result).toBe("transaction-result");
    expect(rawSql).toEqual([
      "SET LOCAL ROLE app_authenticated;\nSELECT set_config('app.tenant_id', '42', true);",
    ]);
  });

  it("omits context SQL when no row level security context values are present", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await callTransactional();
    });

    expect(rawSql).toEqual(["SET LOCAL ROLE anonymous;"]);
  });

  it("throws when a transaction context is unavailable", async () => {
    jest
      .spyOn(EntityManager.prototype, "transactional")
      .mockImplementation(async (cb: any) => {
        return await cb({
          getTransactionContext: () => undefined,
        });
      });

    await expect(
      RequestContext.run(
        new RequestContext({ type: "http" }),
        callTransactional,
      ),
    ).rejects.toThrow("Transaction context is not available");
  });

  it("uses the anonymous role when no user is present", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      setRowLevelSecurityOptions({
        anonymousRole: "app_anonymous",
        getContext: () => [["tenant_id", "42"]],
      });

      await callTransactional();
    });

    expect(rawSql).toEqual([
      "SET LOCAL ROLE app_anonymous;\nSELECT set_config('app.tenant_id', '42', true);",
    ]);
  });

  it("uses the default authenticated role when the tenant authentication marker is present", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      setRowLevelSecurityOptions({
        isAuthenticated: () => true,
        getContext: () => [["tenant_id", "42"]],
      });

      await callTransactional();
    });

    expect(rawSql).toEqual([
      "SET LOCAL ROLE authenticated;\nSELECT set_config('app.tenant_id', '42', true);",
    ]);
  });

  it("uses the request context role when one is set", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RowLevelSecurityContext.setRole("service_role");
      RowLevelSecurityContext.set("tenant_id", "42");

      await callTransactional();
    });

    expect(rawSql).toEqual([
      "SET LOCAL ROLE service_role;\nSELECT set_config('app.tenant_id', '42', true);",
    ]);
  });

  it("sets additional row level security context values from RequestContext", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      setRowLevelSecurityOptions({
        getContext: () => [["tenant_id", "42"]],
      });
      RowLevelSecurityContext.set("user_id", "7");

      await callTransactional();
    });

    expect(rawSql).toEqual([
      "SET LOCAL ROLE anonymous;\nSELECT set_config('app.tenant_id', '42', true),set_config('app.user_id', '7', true);",
    ]);
  });

  it("uses the default anonymous role when the tenant authentication marker is absent", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      setRowLevelSecurityOptions({
        getContext: () => [["tenant_id", "42"]],
      });

      await callTransactional();
    });

    expect(rawSql).toEqual([
      "SET LOCAL ROLE anonymous;\nSELECT set_config('app.tenant_id', '42', true);",
    ]);
  });

  it("delegates without tenant SQL when shouldApply returns false", async () => {
    const rawSql: string[] = [];
    const transactionalSpy = mockSuperTransactional(rawSql);
    setRowLevelSecurityOptions({
      shouldApply: () => false,
    });

    const result = await callTransactional();

    expect(result).toBe("transaction-result");
    expect(rawSql).toEqual([]);
    expect(transactionalSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe database role names", async () => {
    const rawSql: string[] = [];
    mockSuperTransactional(rawSql);
    setRowLevelSecurityOptions({
      authenticatedRole: "app.authenticated",
      isAuthenticated: () => true,
    });

    await expect(
      RequestContext.run(
        new RequestContext({ type: "http" }),
        callTransactional,
      ),
    ).rejects.toThrow("Row level security database role must be snake_case");
  });

  it.each(getDelegatedMethodCases())(
    "wraps %s in a row level security transaction when outside a transaction",
    async (methodName, args, result) => {
      const delegatedMethod = jest.fn(() => Promise.resolve(result));
      const transactional = jest.fn(async (cb: any) => {
        return await cb({
          [methodName]: delegatedMethod,
        });
      });
      const entityManager = {
        isInTransaction: () => false,
        transactional,
      };

      const actual = await (
        RowLevelSecurityEntityManager.prototype[methodName] as any
      ).call(entityManager, ...args);

      expect(actual).toBe(result);
      expect(transactional).toHaveBeenCalledTimes(1);
      expect(delegatedMethod.mock.calls[0]?.slice(0, args.length)).toEqual(
        args,
      );
    },
  );

  it.each(getDelegatedMethodCases())(
    "delegates %s directly when already inside a transaction",
    async (methodName, args, result) => {
      const superMethod = jest
        .spyOn(
          EntityManager.prototype as unknown as Record<
            DelegatedMethodName,
            (...args: unknown[]) => Promise<unknown>
          >,
          methodName,
        )
        .mockResolvedValue(result);
      const entityManager = {
        isInTransaction: () => true,
      };

      const actual = await (
        RowLevelSecurityEntityManager.prototype[methodName] as any
      ).call(entityManager, ...args);

      expect(actual).toBe(result);
      expect(superMethod.mock.calls[0]?.slice(0, args.length)).toEqual(args);
    },
  );
});

function mockSuperTransactional(rawSql: string[]) {
  return jest
    .spyOn(EntityManager.prototype, "transactional")
    .mockImplementation(async (cb: any) => {
      const em = {
        getTransactionContext: () => ({
          raw: (sql: string) => {
            rawSql.push(sql);
            return Promise.resolve();
          },
        }),
      };

      return await cb(em);
    });
}

async function callTransactional() {
  return await RowLevelSecurityEntityManager.prototype.transactional.call(
    {} as RowLevelSecurityEntityManager,
    () => "transaction-result",
  );
}

type DelegatedMethodName =
  | "find"
  | "findAll"
  | "findOne"
  | "findOneOrFail"
  | "findAndCount"
  | "findByCursor"
  | "count"
  | "insert"
  | "insertMany"
  | "nativeUpdate"
  | "nativeDelete"
  | "upsert"
  | "upsertMany"
  | "flush";

function getDelegatedMethodCases(): [
  DelegatedMethodName,
  unknown[],
  unknown,
][] {
  class Entity {}

  return [
    ["find", [Entity, { id: "1" }, { limit: 1 }], [{ id: "1" }]],
    ["findAll", [Entity, { limit: 1 }], [{ id: "1" }]],
    ["findOne", [Entity, { id: "1" }], { id: "1" }],
    ["findOneOrFail", [Entity, { id: "1" }], { id: "1" }],
    ["findAndCount", [Entity, { id: "1" }], [[{ id: "1" }], 1]],
    ["findByCursor", [Entity, {}, { first: 10 }], { items: [] }],
    ["count", [Entity, { active: true }], 1],
    ["insert", [Entity, { name: "one" }], "1"],
    ["insertMany", [Entity, [{ name: "one" }]], ["1"]],
    ["nativeUpdate", [Entity, { id: "1" }, { name: "one" }], 1],
    ["nativeDelete", [Entity, { id: "1" }], 1],
    ["upsert", [Entity, { id: "1", name: "one" }], { id: "1" }],
    ["upsertMany", [Entity, [{ id: "1", name: "one" }]], [{ id: "1" }]],
    ["flush", [], undefined],
  ];
}
