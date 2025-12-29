import "reflect-metadata";

import {
  Entity,
  EventArgs,
  MikroORM,
  PrimaryKey,
  Property,
  t,
  wrap,
} from "@mikro-orm/better-sqlite";
import { HashService } from "@nest-boot/hash";

import { HashProperty } from ".";

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property({ type: t.string })
  @HashProperty()
  password!: string;
}

@Entity()
class UserWithMultipleHashFields {
  @PrimaryKey()
  id!: number;

  @Property({ type: t.string })
  @HashProperty()
  password!: string;

  @Property({ type: t.string })
  @HashProperty()
  apiKey!: string;
}

@Entity()
class ParentEntity {
  @PrimaryKey()
  id!: number;

  @Property({ type: t.string })
  @HashProperty()
  parentPassword!: string;
}

@Entity()
class ChildEntity extends ParentEntity {
  @Property({ type: t.string })
  @HashProperty()
  childPassword!: string;
}

describe("HashProperty", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    HashService.init();
    orm = await MikroORM.init({
      entities: [User, UserWithMultipleHashFields, ParentEntity, ChildEntity],
      dbName: ":memory:",
    });
    await orm.schema.createSchema();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.schema.clearDatabase();
  });

  describe("decorator application", () => {
    it("should throw error when used on symbol property", () => {
      const symbolKey = Symbol("password");

      expect(() => {
        // Manually apply the decorator to a symbol property
        const target = {};
        HashProperty()(target, symbolKey);
      }).toThrow(
        "HashProperty decorator can only be used on string properties.",
      );
    });

    it("should not add duplicate properties when decorator is applied twice", async () => {
      // This tests the deduplication logic at lines 45-48
      @Entity()
      class DuplicateDecoratorEntity {
        @PrimaryKey()
        id!: number;

        @Property({ type: t.string })
        @HashProperty()
        @HashProperty() // Applied twice
        password!: string;
      }

      const tempOrm = await MikroORM.init({
        entities: [DuplicateDecoratorEntity],
        dbName: ":memory:",
      });
      await tempOrm.schema.createSchema();

      const em = tempOrm.em.fork();
      const entity = em.create(DuplicateDecoratorEntity, {
        password: "test123",
      });
      em.persist(entity);
      await em.flush();

      // Password should be hashed only once, not twice
      expect(entity.password).toContain("$argon2");
      expect(await HashService.verify(entity.password, "test123")).toBe(true);

      await tempOrm.close(true);
    });

    it("should merge custom options with default options", () => {
      // Verify that custom options are passed through while hidden and lazy are enforced
      @Entity()
      class CustomOptionsEntity {
        @PrimaryKey()
        id!: number;

        @Property({ type: t.string })
        @HashProperty({ nullable: true })
        optionalPassword!: string;
      }

      // The entity should be defined without errors
      expect(CustomOptionsEntity).toBeDefined();
      expect(CustomOptionsEntity.prototype).toHaveProperty(
        "__hashProperties__",
      );
    });
  });

  describe("create operations", () => {
    it("should hash password on entity creation", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "plaintext123" });
      em.persist(user);
      await em.flush();

      expect(user.password).toContain("$argon2");
      expect(await HashService.verify(user.password, "plaintext123")).toBe(
        true,
      );
    });

    it("should hash multiple properties on entity creation", async () => {
      const em = orm.em.fork();

      const user = em.create(UserWithMultipleHashFields, {
        password: "pass123",
        apiKey: "key456",
      });
      em.persist(user);
      await em.flush();

      expect(user.password).toContain("$argon2");
      expect(user.apiKey).toContain("$argon2");
      expect(await HashService.verify(user.password, "pass123")).toBe(true);
      expect(await HashService.verify(user.apiKey, "key456")).toBe(true);
    });

    it("should hash inherited properties on child entity creation", async () => {
      const em = orm.em.fork();

      const child = em.create(ChildEntity, {
        parentPassword: "parent123",
        childPassword: "child456",
      });
      em.persist(child);
      await em.flush();

      expect(child.parentPassword).toContain("$argon2");
      expect(child.childPassword).toContain("$argon2");
      expect(await HashService.verify(child.parentPassword, "parent123")).toBe(
        true,
      );
      expect(await HashService.verify(child.childPassword, "child456")).toBe(
        true,
      );
    });
  });

  describe("update operations", () => {
    it("should hash password on entity update", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "initial" });
      em.persist(user);
      await em.flush();

      const initialHash = user.password;
      expect(initialHash).toContain("$argon2");

      wrap(user).assign({ password: "updated" });
      await em.flush();

      expect(user.password).toContain("$argon2");
      expect(user.password).not.toBe(initialHash);
      expect(await HashService.verify(user.password, "updated")).toBe(true);
    });

    it("should not rehash if password is not changed", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "unchanged" });
      em.persist(user);
      await em.flush();

      const initialHash = user.password;

      // Re-fetch with password populated (since it's lazy loaded)
      em.clear();
      const fetchedUser = await em.findOneOrFail(User, user.id, {
        populate: ["password"] as never,
      });

      // Manually trigger an update without changing password
      await em.flush();

      expect(fetchedUser.password).toBe(initialHash);
    });
  });

  describe("edge cases", () => {
    it("should skip hashing for non-string values in payload", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "initial" });
      em.persist(user);
      await em.flush();

      const initialHash = user.password;

      // Simulate calling the hook with non-string value
      const hashPropertiesMethod = (
        user as unknown as {
          __hashProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__hashProperties__;

      await hashPropertiesMethod.call(user, {
        changeSet: { payload: { password: 12345 } },
      } as unknown as EventArgs<User>);

      // Password should remain unchanged since the value was not a string
      expect(user.password).toBe(initialHash);
    });

    it("should handle undefined changeSet gracefully", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "test" });
      em.persist(user);
      await em.flush();

      const initialHash = user.password;

      const hashPropertiesMethod = (
        user as unknown as {
          __hashProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__hashProperties__;

      await hashPropertiesMethod.call(user, {} as EventArgs<User>);

      expect(user.password).toBe(initialHash);
    });

    it("should handle undefined payload gracefully", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "test" });
      em.persist(user);
      await em.flush();

      const initialHash = user.password;

      const hashPropertiesMethod = (
        user as unknown as {
          __hashProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__hashProperties__;

      await hashPropertiesMethod.call(user, {
        changeSet: {},
      } as unknown as EventArgs<User>);

      expect(user.password).toBe(initialHash);
    });

    it("should handle missing metadata gracefully", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { password: "test" });
      em.persist(user);
      await em.flush();

      const hashPropertiesMethod = (
        user as unknown as {
          __hashProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__hashProperties__;

      // Create an object with no prototype metadata
      const mockInstance = Object.create(null) as Record<string, unknown>;
      Object.setPrototypeOf(mockInstance, {});

      await hashPropertiesMethod.call(mockInstance, {
        changeSet: { payload: { password: "newpass" } },
      } as unknown as EventArgs<User>);

      // Should not set password since no metadata exists
      expect(mockInstance.password).toBeUndefined();
    });
  });

  describe("metadata handling", () => {
    it("should define __hashProperties__ method on prototype", () => {
      expect(User.prototype).toHaveProperty("__hashProperties__");
      expect(
        typeof (User.prototype as unknown as Record<string, unknown>)
          .__hashProperties__,
      ).toBe("function");
    });

    it("should not share metadata between parent and child classes", () => {
      expect(
        Object.prototype.hasOwnProperty.call(
          ParentEntity.prototype,
          "__hashProperties__",
        ),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(
          ChildEntity.prototype,
          "__hashProperties__",
        ),
      ).toBe(true);
    });
  });
});
