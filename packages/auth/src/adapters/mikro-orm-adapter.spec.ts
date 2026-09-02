/**
 * Unit tests for convertWhereToMikroOrm
 *
 * Locks down AND/OR connector semantics to prevent returning raw arrays
 * that MikroORM interprets as OR (which caused an OIDC login identity
 * collision bug in production).
 */

// Mock better-auth/adapters to avoid ESM compatibility issues.
const { mockCreateAdapterFactory } = vi.hoisted(() => ({
  mockCreateAdapterFactory: vi.fn(
    (config: Record<string, unknown>) => (options: unknown) => ({
      ...config,
      options,
    }),
  ),
}));
vi.mock("better-auth/adapters", () => ({
  createAdapterFactory: mockCreateAdapterFactory,
}));

// Import the function under test
import { LockMode, MikroORM, Raw } from "@mikro-orm/core";

import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "../entities/index.js";
import {
  convertWhereToMikroOrm,
  mikroOrmAdapter,
} from "./mikro-orm-adapter.js";

/** Helper to construct a Where condition */
function makeWhere(
  field: string,
  operator: string,
  value: unknown,
  connector: "AND" | "OR" = "AND",
  mode: "insensitive" | "sensitive" = "sensitive",
) {
  return { connector, field, mode, operator, value } as Parameters<
    typeof convertWhereToMikroOrm
  >[0][number];
}

describe("convertWhereToMikroOrm", () => {
  describe("AND connector", () => {
    it("should merge multiple AND conditions into a $and object (OIDC login reproduction)", () => {
      const where = [
        makeWhere("accountId", "eq", "w9mj34kow1sc", "AND"),
        makeWhere("providerId", "eq", "oidc", "AND"),
      ];

      const result = convertWhereToMikroOrm(where);

      // Must be a $and object, not an array (arrays are interpreted as $or by MikroORM)
      expect(result).toEqual({
        $and: [
          { accountId: { $eq: "w9mj34kow1sc" } },
          { providerId: { $eq: "oidc" } },
        ],
      });
      expect(Array.isArray(result)).toBe(false);
    });

    it("should default to AND when connector is omitted", () => {
      const where = [
        { field: "name", operator: "eq", value: "test" },
        { field: "age", operator: "gt", value: 18 },
      ] as Parameters<typeof convertWhereToMikroOrm>[0];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $and: [{ name: { $eq: "test" } }, { age: { $gt: 18 } }],
      });
    });

    it("should handle duplicate fields correctly (range query, no key override)", () => {
      const where = [
        makeWhere("createdAt", "gte", "2024-01-01"),
        makeWhere("createdAt", "lt", "2025-01-01"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $and: [
          { createdAt: { $gte: "2024-01-01" } },
          { createdAt: { $lt: "2025-01-01" } },
        ],
      });
    });
  });

  describe("OR connector", () => {
    it("should wrap all OR conditions in a $or object", () => {
      const where = [
        makeWhere("email", "eq", "a@test.com", "OR"),
        makeWhere("email", "eq", "b@test.com", "OR"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $or: [
          { email: { $eq: "a@test.com" } },
          { email: { $eq: "b@test.com" } },
        ],
      });
    });
  });

  describe("mixed AND/OR", () => {
    it("combines AND conditions with the OR group", () => {
      const where = [
        makeWhere("accountId", "eq", "xxx", "AND"),
        makeWhere("providerId", "eq", "oidc", "AND"),
        makeWhere("status", "eq", "active", "OR"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $and: [
          { accountId: { $eq: "xxx" } },
          { providerId: { $eq: "oidc" } },
          { $or: [{ status: { $eq: "active" } }] },
        ],
      });
    });

    it("keeps every OR condition in one group", () => {
      const where = [
        makeWhere("a", "eq", "1", "AND"),
        makeWhere("b", "eq", "2", "AND"),
        makeWhere("c", "eq", "3", "OR"),
        makeWhere("d", "eq", "4", "OR"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $and: [
          { a: { $eq: "1" } },
          { b: { $eq: "2" } },
          {
            $or: [{ c: { $eq: "3" } }, { d: { $eq: "4" } }],
          },
        ],
      });
    });

    it("should flatten when only one branch exists", () => {
      const where = [makeWhere("a", "eq", "1", "OR")];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({ a: { $eq: "1" } });
    });
  });

  describe("case-insensitive mode", () => {
    it("normalizes string equality through a LOWER expression", () => {
      const result = convertWhereToMikroOrm([
        makeWhere("email", "eq", "User@Example.COM", "AND", "insensitive"),
      ]) as { $and: Record<string, unknown>[] };
      const condition = result.$and[0];
      const key = Reflect.ownKeys(condition)[0];

      expect(Raw.getKnownFragment(key)).toMatchObject({ sql: "lower(??)" });
      expect(Reflect.get(condition, key)).toEqual({
        $eq: "user@example.com",
      });
    });

    it("normalizes string arrays for in queries", () => {
      const result = convertWhereToMikroOrm([
        makeWhere(
          "email",
          "in",
          ["A@Example.COM", "B@Example.COM"],
          "AND",
          "insensitive",
        ),
      ]) as { $and: Record<string, unknown>[] };
      const condition = result.$and[0];
      const key = Reflect.ownKeys(condition)[0];

      expect(Reflect.get(condition, key)).toEqual({
        $in: ["a@example.com", "b@example.com"],
      });
    });

    it("uses the resolved database field name in LOWER expressions", () => {
      const result = convertWhereToMikroOrm(
        [makeWhere("displayName", "eq", "Alice", "AND", "insensitive")],
        (field) => (field === "displayName" ? "display_name" : field),
      ) as { $and: Record<string, unknown>[] };
      const condition = result.$and[0];
      const key = Reflect.ownKeys(condition)[0];

      expect(Raw.getKnownFragment(key)?.params).toEqual(["display_name"]);
      expect(Reflect.get(condition, key)).toEqual({ $eq: "alice" });
    });
  });

  describe("operator mapping", () => {
    const testOperator = (
      operator: string,
      mikroOp: string,
      value: unknown = "test",
    ) => {
      const where = [makeWhere("f", operator, value)];
      const result = convertWhereToMikroOrm(where);
      expect(result).toEqual({ $and: [{ f: { [mikroOp]: value } }] });
    };

    it("eq → $eq", () => {
      testOperator("eq", "$eq");
    });
    it("ne → $ne", () => {
      testOperator("ne", "$ne");
    });
    it("lt → $lt", () => {
      testOperator("lt", "$lt", 10);
    });
    it("lte → $lte", () => {
      testOperator("lte", "$lte", 10);
    });
    it("gt → $gt", () => {
      testOperator("gt", "$gt", 10);
    });
    it("gte → $gte", () => {
      testOperator("gte", "$gte", 10);
    });
    it("in → $in", () => {
      testOperator("in", "$in", [1, 2]);
    });
    it("not_in → $nin", () => {
      testOperator("not_in", "$nin", [1, 2]);
    });

    it("contains → $like %value%", () => {
      const result = convertWhereToMikroOrm([
        makeWhere("name", "contains", "test"),
      ]);
      expect(result).toEqual({ $and: [{ name: { $like: "%test%" } }] });
    });

    it("starts_with → $like value%", () => {
      const result = convertWhereToMikroOrm([
        makeWhere("name", "starts_with", "test"),
      ]);
      expect(result).toEqual({ $and: [{ name: { $like: "test%" } }] });
    });

    it("ends_with → $like %value", () => {
      const result = convertWhereToMikroOrm([
        makeWhere("name", "ends_with", "test"),
      ]);
      expect(result).toEqual({ $and: [{ name: { $like: "%test" } }] });
    });
  });

  describe("string type validation", () => {
    it("should throw when contains receives a non-string value", () => {
      expect(() =>
        convertWhereToMikroOrm([makeWhere("f", "contains", 123)]),
      ).toThrow("Value must be a string");
    });

    it("should throw when starts_with receives a non-string value", () => {
      expect(() =>
        convertWhereToMikroOrm([makeWhere("f", "starts_with", 123)]),
      ).toThrow("Value must be a string");
    });

    it("should throw when ends_with receives a non-string value", () => {
      expect(() =>
        convertWhereToMikroOrm([makeWhere("f", "ends_with", 123)]),
      ).toThrow("Value must be a string");
    });

    it.each(["in", "not_in"])(
      "should throw when %s receives a non-array value",
      (operator) => {
        expect(() =>
          convertWhereToMikroOrm([makeWhere("f", operator, "value")]),
        ).toThrow(`Value must be an array for operator "${operator}"`);
      },
    );
  });

  describe("unsupported operator", () => {
    it("should throw on unknown operator", () => {
      expect(() =>
        convertWhereToMikroOrm([makeWhere("f", "unknown_op" as never, "x")]),
      ).toThrow("Unsupported operator: unknown_op");
    });
  });
});

class TestAccount extends BaseAccount {}
class TestApiKey {
  id!: string;
  name!: string;
  start!: string;
  prefix!: string;
  key!: string;
  enabled!: boolean;
  permissions!: string[];
  updatedAt!: Date;
  workspace!: never;
}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestVerification extends BaseVerification {}
class TestWorkspace {
  id!: string;
  name!: string;
}
class TestWorkspaceMember {
  id!: string;
  name!: string;
  role!: "ADMIN" | "MEMBER" | "OWNER";
  status!: "ACTIVE" | "DISABLED";
  workspace!: never;
}
class TestWorkspaceInvitation {}

const entities = {
  account: TestAccount,
  apiKey: TestApiKey,
  session: TestSession,
  user: TestUser,
  verification: TestVerification,
  workspace: TestWorkspace,
  workspaceInvitation: TestWorkspaceInvitation,
  workspaceMember: TestWorkspaceMember,
};

function createOrm() {
  const flush = vi.fn();
  const em = {
    assign: vi.fn(),
    count: vi.fn(),
    create: vi.fn((_entity, data) => ({ ...data })),
    findAll: vi.fn(),
    findOne: vi.fn(),
    flush,
    getMetadata: vi.fn(() => ({
      get: vi.fn(() => ({
        properties: {
          email: { fieldNames: ["email_address"] },
        },
      })),
    })),
    nativeDelete: vi.fn(),
    nativeUpdate: vi.fn(),
    persist: vi.fn(() => ({
      flush,
    })),
    remove: vi.fn(() => ({ flush })),
    transactional: vi.fn(),
  };
  em.transactional.mockImplementation(async (callback) => await callback(em));

  return {
    em,
    flush,
    orm: {
      em,
    } as unknown as MikroORM,
  };
}

function createAdapter(
  orm: MikroORM,
  context: {
    getDefaultFieldName?: (input: { field: string; model: string }) => string;
    getDefaultModelName?: (model: string) => string;
    getFieldName?: (input: { field: string; model: string }) => string;
    schema?: Record<string, { fields: Record<string, unknown> }>;
  } = {},
) {
  mikroOrmAdapter({ entities, orm })({} as never);
  const adapterOptions = mockCreateAdapterFactory.mock.calls.at(-1)?.[0] as {
    adapter: (
      context: unknown,
    ) => Record<string, (...args: any[]) => Promise<any>>;
  };

  return adapterOptions.adapter(createAdapterContext(context));
}

function createAdapterContext(
  context: {
    getDefaultFieldName?: (input: { field: string; model: string }) => string;
    getDefaultModelName?: (model: string) => string;
    getFieldName?: (input: { field: string; model: string }) => string;
    schema?: Record<string, { fields: Record<string, unknown> }>;
  } = {},
) {
  return {
    getDefaultFieldName: ({ field }: { field: string }) => field,
    getDefaultModelName: (model: string) => model,
    getFieldName: ({ field }: { field: string }) => field,
    schema: {},
    ...context,
  };
}

describe("mikroOrmAdapter", () => {
  beforeEach(() => {
    mockCreateAdapterFactory.mockClear();
  });

  it("should configure better-auth adapter capabilities", () => {
    const { orm } = createOrm();

    mikroOrmAdapter({
      debugLogs: true,
      entities,
      orm,
    })({} as never);

    expect(mockCreateAdapterFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          adapterId: "mikro-orm-adapter",
          adapterName: "MikroORM Adapter",
          debugLogs: true,
          disableIdGeneration: true,
          supportsArrays: true,
          supportsBooleans: true,
          supportsDates: true,
          supportsJSON: true,
          supportsNumericIds: false,
          usePlural: false,
        }),
      }),
    );
  });

  it("runs Better Auth transactions on one transactional entity manager", async () => {
    const { em, orm } = createOrm();
    const verification = { id: "verification-1", value: "one-time-token" };
    em.findOne.mockResolvedValue(verification);
    const factory = mikroOrmAdapter({ entities, orm });
    factory({} as never);
    const rootAdapterOptions = mockCreateAdapterFactory.mock.calls[0][0] as {
      config: {
        transaction: <T>(
          callback: (adapter: unknown) => Promise<T>,
        ) => Promise<T>;
      };
    };

    await expect(
      rootAdapterOptions.config.transaction(async (transactionAdapter) => {
        const nestedAdapterOptions = transactionAdapter as {
          adapter: (context: {
            getDefaultModelName: (model: string) => string;
          }) => Record<string, (...args: any[]) => Promise<any>>;
        };
        const adapter = nestedAdapterOptions.adapter(createAdapterContext());

        return await adapter.consumeOne({
          model: "verification",
          where: [makeWhere("value", "eq", "one-time-token")],
        });
      }),
    ).resolves.toBe(verification);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(mockCreateAdapterFactory).toHaveBeenCalledTimes(2);
    expect(
      (
        mockCreateAdapterFactory.mock.calls[1][0] as {
          config: { transaction: boolean };
        }
      ).config.transaction,
    ).toBe(false);
  });

  it("isolates transaction options between Better Auth instances", async () => {
    const { orm } = createOrm();
    const factory = mikroOrmAdapter({ entities, orm });
    const firstOptions = { appName: "First" } as never;
    const secondOptions = { appName: "Second" } as never;

    factory(firstOptions);
    const firstAdapterOptions = mockCreateAdapterFactory.mock.calls[0][0] as {
      config: {
        transaction: <T>(
          callback: (adapter: { options: unknown }) => Promise<T>,
        ) => Promise<T>;
      };
    };
    factory(secondOptions);

    await expect(
      firstAdapterOptions.config.transaction(
        async (adapter) => await Promise.resolve(adapter.options),
      ),
    ).resolves.toBe(firstOptions);
  });

  it("should create and persist entities", async () => {
    const { em, flush, orm } = createOrm();
    const adapter = createAdapter(orm);

    await expect(
      adapter.create({
        data: {
          email: "user@example.com",
        },
        model: "user",
      }),
    ).resolves.toEqual({
      email: "user@example.com",
    });

    expect(em.create).toHaveBeenCalledWith(TestUser, {
      email: "user@example.com",
    });
    expect(em.persist).toHaveBeenCalledWith({
      email: "user@example.com",
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("should resolve workspace and API key entities", async () => {
    const { em, orm } = createOrm();
    const adapter = createAdapter(orm);

    await adapter.create({ data: { name: "Workspace" }, model: "workspace" });
    await adapter.create({ data: { name: "Key" }, model: "apiKey" });

    expect(em.create).toHaveBeenNthCalledWith(1, TestWorkspace, {
      name: "Workspace",
    });
    expect(em.create).toHaveBeenNthCalledWith(2, TestApiKey, {
      name: "Key",
    });
  });

  it("resolves customized Better Auth model names to configured entities", async () => {
    const { em, orm } = createOrm();
    const adapter = createAdapter(orm, {
      getDefaultModelName: (model) => (model === "auth_users" ? "user" : model),
    });

    await adapter.create({
      data: { email: "user@example.com" },
      model: "auth_users",
    });

    expect(em.create).toHaveBeenCalledWith(TestUser, {
      email: "user@example.com",
    });
  });

  it("maps customized Better Auth field names to MikroORM properties", async () => {
    const { em, orm } = createOrm();
    const entity = {
      attempts: 2,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      email: "user@example.com",
    };
    em.findOne.mockResolvedValue(entity);
    em.findAll.mockResolvedValue([entity]);
    const fieldNames: Record<string, string> = {
      attempts_count: "attempts",
      created_at: "createdAt",
      email_address: "email",
    };
    const databaseFieldNames: Record<string, string> = {
      attempts: "attempts_count",
      createdAt: "created_at",
      email: "email_address",
    };
    const adapter = createAdapter(orm, {
      getDefaultFieldName: ({ field }) => fieldNames[field] ?? field,
      getFieldName: ({ field }) => databaseFieldNames[field] ?? field,
      schema: {
        user: {
          fields: {
            attempts: { fieldName: "attempts_count" },
            createdAt: { fieldName: "created_at" },
            email: { fieldName: "email_address" },
          },
        },
      },
    });

    await adapter.create({
      data: { email_address: "created@example.com" },
      model: "user",
    });
    const updated = await adapter.update({
      model: "user",
      update: { email_address: "updated@example.com" },
      where: [makeWhere("email_address", "eq", "user@example.com")],
    });
    await adapter.incrementOne({
      increment: { attempts_count: 1 },
      model: "user",
      where: [makeWhere("email_address", "eq", "user@example.com")],
    });
    const found = await adapter.findMany({
      model: "user",
      sortBy: { direction: "desc", field: "created_at" },
      where: [makeWhere("email_address", "eq", "user@example.com")],
    });

    expect(em.create).toHaveBeenCalledWith(TestUser, {
      email: "created@example.com",
    });
    expect(em.assign).toHaveBeenCalledWith(entity, {
      email: "updated@example.com",
    });
    expect(em.assign).toHaveBeenLastCalledWith(entity, { attempts: 3 });
    expect(em.findOne).toHaveBeenCalledWith(TestUser, {
      $and: [{ email: { $eq: "user@example.com" } }],
    });
    expect(em.findAll).toHaveBeenCalledWith(TestUser, {
      limit: undefined,
      offset: 0,
      orderBy: { createdAt: "desc" },
      where: {
        $and: [{ email: { $eq: "user@example.com" } }],
      },
    });
    expect(updated).toMatchObject({
      email_address: "user@example.com",
    });
    expect(found).toEqual([
      expect.objectContaining({
        created_at: entity.createdAt,
        email_address: "user@example.com",
      }),
    ]);
  });

  it("uses MikroORM column metadata for case-insensitive queries", async () => {
    const { em, orm } = createOrm();
    em.findOne.mockResolvedValue({ email: "user@example.com" });
    const adapter = createAdapter(orm);

    await adapter.findOne({
      model: "user",
      where: [
        makeWhere("email", "eq", "User@Example.COM", "AND", "insensitive"),
      ],
    });

    const query = em.findOne.mock.calls[0][1] as {
      $and: Record<string, unknown>[];
    };
    const condition = query.$and[0];
    const key = Reflect.ownKeys(condition)[0];
    expect(Raw.getKnownFragment(key)?.params).toEqual(["email_address"]);
    expect(Reflect.get(condition, key)).toEqual({
      $eq: "user@example.com",
    });
  });

  it("fails with an actionable error for an unconfigured model", async () => {
    const { orm } = createOrm();
    const adapter = createAdapter(orm);

    await expect(
      adapter.create({ data: {}, model: "unknown" }),
    ).rejects.toThrow(
      'No MikroORM entity is configured for Better Auth model "unknown"',
    );
  });

  it("should update an existing entity", async () => {
    const { em, orm } = createOrm();
    const entity = {
      id: "user-1",
      name: "Old",
    };
    em.findOne.mockResolvedValue(entity);
    const adapter = createAdapter(orm);

    await expect(
      adapter.update({
        model: "user",
        update: {
          name: "New",
        },
        where: [makeWhere("id", "eq", "user-1")],
      }),
    ).resolves.toBe(entity);

    expect(em.findOne).toHaveBeenCalledWith(TestUser, {
      $and: [
        {
          id: {
            $eq: "user-1",
          },
        },
      ],
    });
    expect(em.assign).toHaveBeenCalledWith(entity, {
      name: "New",
    });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("should return null when update cannot find an entity", async () => {
    const { em, orm } = createOrm();
    em.findOne.mockResolvedValue(null);
    const adapter = createAdapter(orm);

    await expect(
      adapter.update({
        model: "user",
        update: {
          name: "New",
        },
        where: [makeWhere("id", "eq", "missing")],
      }),
    ).resolves.toBeNull();

    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("should update and delete many entities", async () => {
    const { em, orm } = createOrm();
    em.nativeUpdate.mockResolvedValue(2);
    em.nativeDelete.mockResolvedValue(3);
    const adapter = createAdapter(orm);
    const where = [makeWhere("providerId", "eq", "oidc")];

    await expect(
      adapter.updateMany({
        model: "account",
        update: {
          scope: "email",
        },
        where,
      }),
    ).resolves.toBe(2);
    await expect(
      adapter.deleteMany({
        model: "account",
        where,
      }),
    ).resolves.toBe(3);
    await adapter.delete({
      model: "account",
      where,
    });

    expect(em.nativeUpdate).toHaveBeenCalledWith(
      TestAccount,
      {
        $and: [
          {
            providerId: {
              $eq: "oidc",
            },
          },
        ],
      },
      {
        scope: "email",
      },
    );
    expect(em.nativeDelete).toHaveBeenCalledTimes(2);
  });

  it("should atomically consume one entity inside a pessimistic transaction", async () => {
    const { em, orm } = createOrm();
    const verification = { id: "verification-1", value: "one-time-token" };
    em.findOne.mockResolvedValue(verification);
    const adapter = createAdapter(orm);
    const where = [makeWhere("value", "eq", "one-time-token")];

    await expect(
      adapter.consumeOne({ model: "verification", where }),
    ).resolves.toBe(verification);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.findOne).toHaveBeenCalledWith(
      TestVerification,
      convertWhereToMikroOrm(where),
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).toHaveBeenCalledWith(verification);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("should atomically increment and set one guarded entity", async () => {
    const { em, orm } = createOrm();
    const record = { attempts: 2, id: "verification-1", status: "pending" };
    em.findOne.mockResolvedValue(record);
    const adapter = createAdapter(orm);

    await expect(
      adapter.incrementOne({
        increment: { attempts: 1 },
        model: "verification",
        set: { status: "locked" },
        where: [makeWhere("attempts", "lt", 3)],
      }),
    ).resolves.toBe(record);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.assign).toHaveBeenCalledWith(record, {
      attempts: 3,
      status: "locked",
    });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("gives increments precedence when set contains the same field", async () => {
    const { em, orm } = createOrm();
    const record = { attempts: 2, id: "verification-1" };
    em.findOne.mockResolvedValue(record);
    const adapter = createAdapter(orm);

    await adapter.incrementOne({
      increment: { attempts: 1 },
      model: "verification",
      set: { attempts: 100 },
      where: [makeWhere("id", "eq", "verification-1")],
    });

    expect(em.assign).toHaveBeenCalledWith(record, { attempts: 3 });
  });

  it("should return null without mutating when an atomic selector misses", async () => {
    const { em, orm } = createOrm();
    em.findOne.mockResolvedValue(null);
    const adapter = createAdapter(orm);

    await expect(
      adapter.consumeOne({
        model: "verification",
        where: [makeWhere("value", "eq", "missing")],
      }),
    ).resolves.toBeNull();
    await expect(
      adapter.incrementOne({
        increment: { attempts: 1 },
        model: "verification",
        where: [makeWhere("value", "eq", "missing")],
      }),
    ).resolves.toBeNull();

    expect(em.remove).not.toHaveBeenCalled();
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("should find one and many entities", async () => {
    const { em, orm } = createOrm();
    const session = {
      token: "session-token",
    };
    const sessions = [session];
    em.findOne.mockResolvedValue(session);
    em.findAll.mockResolvedValue(sessions);
    const adapter = createAdapter(orm);

    await expect(
      adapter.findOne({
        model: "session",
        where: [makeWhere("token", "eq", "session-token")],
      }),
    ).resolves.toBe(session);
    await expect(
      adapter.findMany({
        limit: 10,
        model: "session",
        sortBy: {
          direction: "desc",
          field: "createdAt",
        },
        where: [makeWhere("token", "eq", "session-token")],
      }),
    ).resolves.toBe(sessions);

    expect(em.findAll).toHaveBeenCalledWith(TestSession, {
      limit: 10,
      offset: 0,
      orderBy: {
        createdAt: "desc",
      },
      where: {
        $and: [
          {
            token: {
              $eq: "session-token",
            },
          },
        ],
      },
    });
  });

  it("should find many entities without optional filters", async () => {
    const { em, orm } = createOrm();
    em.findAll.mockResolvedValue([]);
    const adapter = createAdapter(orm);

    await expect(
      adapter.findMany({
        model: "verification",
      }),
    ).resolves.toEqual([]);

    expect(em.findAll).toHaveBeenCalledWith(TestVerification, {
      limit: undefined,
      offset: 0,
    });
  });

  it("should count entities with and without filters", async () => {
    const { em, orm } = createOrm();
    em.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    const adapter = createAdapter(orm);

    await expect(
      adapter.count({
        model: "user",
        where: [makeWhere("email", "eq", "user@example.com")],
      }),
    ).resolves.toBe(1);
    await expect(
      adapter.count({
        model: "user",
      }),
    ).resolves.toBe(4);

    expect(em.count).toHaveBeenNthCalledWith(1, TestUser, {
      $and: [
        {
          email: {
            $eq: "user@example.com",
          },
        },
      ],
    });
    expect(em.count).toHaveBeenNthCalledWith(2, TestUser, undefined);
  });
});
