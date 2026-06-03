/**
 * Unit tests for convertWhereToMikroOrm
 *
 * Locks down AND/OR connector semantics to prevent returning raw arrays
 * that MikroORM interprets as OR (which caused an OIDC login identity
 * collision bug in production).
 */

// Mock better-auth/adapters to avoid ESM compatibility issues.
const mockCreateAdapterFactory = jest.fn((config) => config);
jest.mock("better-auth/adapters", () => ({
  createAdapterFactory: mockCreateAdapterFactory,
}));

// Import the function under test
import { MikroORM } from "@mikro-orm/core";

import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "../entities";
import { convertWhereToMikroOrm, mikroOrmAdapter } from "./mikro-orm-adapter";

/** Helper to construct a Where condition */
function makeWhere(
  field: string,
  operator: string,
  value: unknown,
  connector: "AND" | "OR" = "AND",
) {
  return { field, operator, value, connector } as Parameters<
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
    it("A AND B OR C → (A AND B) OR C", () => {
      const where = [
        makeWhere("accountId", "eq", "xxx", "AND"),
        makeWhere("providerId", "eq", "oidc", "AND"),
        makeWhere("status", "eq", "active", "OR"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $or: [
          {
            $and: [
              { accountId: { $eq: "xxx" } },
              { providerId: { $eq: "oidc" } },
            ],
          },
          { status: { $eq: "active" } },
        ],
      });
    });

    it("A AND B OR C AND D → (A AND B) OR (C AND D)", () => {
      const where = [
        makeWhere("a", "eq", "1", "AND"),
        makeWhere("b", "eq", "2", "AND"),
        makeWhere("c", "eq", "3", "OR"),
        makeWhere("d", "eq", "4", "AND"),
      ];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({
        $or: [
          { $and: [{ a: { $eq: "1" } }, { b: { $eq: "2" } }] },
          { $and: [{ c: { $eq: "3" } }, { d: { $eq: "4" } }] },
        ],
      });
    });

    it("should flatten when only one branch exists", () => {
      const where = [makeWhere("a", "eq", "1", "OR")];

      const result = convertWhereToMikroOrm(where);

      expect(result).toEqual({ a: { $eq: "1" } });
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
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestVerification extends BaseVerification {}

const entities = {
  account: TestAccount,
  session: TestSession,
  user: TestUser,
  verification: TestVerification,
};

function createOrm() {
  const flush = jest.fn();
  const em = {
    assign: jest.fn(),
    count: jest.fn(),
    create: jest.fn((_entity, data) => ({ ...data })),
    findAll: jest.fn(),
    findOne: jest.fn(),
    flush,
    nativeDelete: jest.fn(),
    nativeUpdate: jest.fn(),
    persist: jest.fn(() => ({
      flush,
    })),
  };

  return {
    em,
    flush,
    orm: {
      em,
    } as unknown as MikroORM,
  };
}

describe("mikroOrmAdapter", () => {
  beforeEach(() => {
    mockCreateAdapterFactory.mockClear();
  });

  it("should configure better-auth adapter capabilities", () => {
    const { orm } = createOrm();

    const adapterFactory = mikroOrmAdapter({
      debugLogs: true,
      entities,
      orm,
    }) as any;

    expect(mockCreateAdapterFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          adapterId: "mikro-orm-adapter",
          adapterName: "MikroORM Adapter",
          debugLogs: true,
          disableIdGeneration: true,
          supportsBooleans: true,
          supportsDates: true,
          supportsJSON: true,
          supportsNumericIds: true,
          usePlural: false,
        }),
      }),
    );
    expect(adapterFactory.config.debugLogs).toBe(true);
  });

  it("should create and persist entities", async () => {
    const { em, flush, orm } = createOrm();
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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

  it("should update an existing entity", async () => {
    const { em, orm } = createOrm();
    const entity = {
      id: "user-1",
      name: "Old",
    };
    em.findOne.mockResolvedValue(entity);
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();
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

  it("should find one and many entities", async () => {
    const { em, orm } = createOrm();
    const session = {
      token: "session-token",
    };
    const sessions = [session];
    em.findOne.mockResolvedValue(session);
    em.findAll.mockResolvedValue(sessions);
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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
    const adapter = (mikroOrmAdapter({ entities, orm }) as any).adapter();

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
