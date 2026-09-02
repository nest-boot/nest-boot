import { type MikroORM } from "@mikro-orm/core";
import type { BetterAuthOptions } from "better-auth";

import { BaseUser } from "../entities/index.js";
import { mikroOrmAdapter } from "./mikro-orm-adapter.js";

class TestUser extends BaseUser {}

describe("mikroOrmAdapter field mapping", () => {
  it("round-trips Better Auth model and field aliases", async () => {
    const flush = vi.fn();
    const persistedUser = {
      email: "user@example.com",
      emailVerified: false,
      name: "User",
    };
    const em = {
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
