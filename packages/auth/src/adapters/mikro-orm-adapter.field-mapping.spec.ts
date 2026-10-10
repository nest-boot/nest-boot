import { type MikroORM } from "@mikro-orm/core";
import type { BetterAuthOptions } from "better-auth";

import { Account as BaseAccount } from "../entities/account.entity.js";
import { Session as BaseSession } from "../entities/session.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import { mikroOrmAdapter } from "./mikro-orm-adapter.js";

const TestUser = BaseUser;
type TestUser = BaseUser;
const TestAccount = BaseAccount;
type TestAccount = BaseAccount;
const TestSession = BaseSession;
type TestSession = BaseSession;

describe("mikroOrmAdapter field mapping", () => {
  describe.each(["account", "session"] as const)("%s ownership", (model) => {
    it.each([false, true])(
      "round-trips userId through user (aliases: %s)",
      async (aliases) => {
        const entityClass = model === "account" ? TestAccount : TestSession;
        const user = Object.assign(new TestUser(), {
          id: "user-1",
          email: "private@example.com",
        });
        const persisted = { id: "record-1", user };
        const flush = vi.fn();
        const em = {
          getContext: vi.fn().mockReturnThis(),
          getSessionContext: vi.fn(),
          create: vi.fn(() => persisted),
          findOne: vi.fn().mockResolvedValue(persisted),
          findAll: vi.fn().mockResolvedValue([persisted]),
          assign: vi.fn(),
          nativeUpdate: vi.fn().mockResolvedValue(1),
          nativeDelete: vi.fn().mockResolvedValue(1),
          count: vi.fn().mockResolvedValue(1),
          flush,
          persist: vi.fn(() => ({ flush })),
          getMetadata: vi.fn(() => ({
            get: vi.fn(() => ({
              properties: { user: { fieldNames: ["user_id"] } },
            })),
          })),
        };
        const options: BetterAuthOptions = aliases
          ? {
              [model]: {
                modelName: `auth_${model}`,
                fields: { userId: "owner_id" },
              },
            }
          : {};
        const adapter = mikroOrmAdapter({
          entities: { [model]: entityClass } as never,
          orm: { em } as unknown as MikroORM,
        })(options);
        const where = [{ field: "userId", value: user.id }];
        const expectedWhere = { $and: [{ user: { $eq: user.id } }] };

        const created = await adapter.create({
          model,
          data: { userId: user.id },
        });
        expect(em.create).toHaveBeenCalledWith(
          entityClass,
          expect.objectContaining({ user: user.id }),
        );
        expect(created).toMatchObject({ userId: user.id });
        expect(created).not.toHaveProperty("user");

        const found = await adapter.findOne({ model, where });
        expect(em.findOne).toHaveBeenCalledWith(entityClass, expectedWhere);
        expect(found).toMatchObject({ userId: user.id });
        expect(found).not.toHaveProperty("user");
        expect(await adapter.findMany({ model, where })).toEqual([created]);
        expect(await adapter.count({ model, where })).toBe(1);
        expect(em.count).toHaveBeenCalledWith(entityClass, expectedWhere);

        await adapter.update({ model, where, update: { userId: "user-2" } });
        expect(em.assign).toHaveBeenCalledWith(
          persisted,
          expect.objectContaining({ user: "user-2" }),
        );
        await adapter.updateMany({
          model,
          where,
          update: { userId: "user-2" },
        });
        expect(em.nativeUpdate).toHaveBeenCalledWith(
          entityClass,
          expectedWhere,
          expect.objectContaining({ user: "user-2" }),
        );
        await adapter.delete({ model, where });
        expect(em.nativeDelete).toHaveBeenCalledWith(
          entityClass,
          expectedWhere,
        );
        expect(persisted.user).toBe(user);
      },
    );
  });

  it("round-trips Better Auth model and field aliases", async () => {
    const flush = vi.fn();
    const persistedUser = {
      email: "user@example.com",
      emailVerified: false,
      name: "User",
    };
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext: vi.fn(),
      create: vi.fn((_entity, data) => ({ ...data })),
      findOne: vi.fn().mockResolvedValue(persistedUser),
      flush,
      getMetadata: vi.fn(() => ({
        get: vi.fn(() => ({
          properties: {
            email: { fieldNames: ["email_address"] },
          },
        })),
      })),
      persist: vi.fn(() => ({ flush })),
    };
    const orm = { em } as unknown as MikroORM;
    const entities = { user: TestUser } as never;
    const options = {
      user: {
        fields: { email: "email_address" },
        modelName: "auth_users",
      },
    } satisfies BetterAuthOptions;
    const adapter = mikroOrmAdapter({ entities, orm })(options);

    const created = await adapter.create({
      data: persistedUser,
      model: "user",
    });
    const found = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "user@example.com" }],
    });

    expect(em.create).toHaveBeenCalledWith(
      TestUser,
      expect.objectContaining({ email: "user@example.com" }),
    );
    expect(em.findOne).toHaveBeenCalledWith(TestUser, {
      $and: [{ email: { $eq: "user@example.com" } }],
    });
    expect(created).toMatchObject(persistedUser);
    expect(found).toMatchObject(persistedUser);
  });
});
