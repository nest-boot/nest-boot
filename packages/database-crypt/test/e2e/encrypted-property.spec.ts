import "reflect-metadata";

import { type EventArgs, type Opt, t, wrap } from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/decorators/legacy";
import { MikroORM } from "@mikro-orm/pglite";
import { CryptService } from "@nest-boot/crypt";

import { EncryptedProperty } from "../../src/index.js";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

/**
 * Returns unique in-memory database name for this test.
 * @returns Unique in-memory database name for this test.
 */
function nextDbName() {
  return `memory://${String(process.pid)}-${String(Date.now())}-${String(Math.random())}`;
}

@Entity()
class User {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @EncryptedProperty({ type: t.string })
  ssn!: string;
}

@Entity()
class UserWithMultipleEncryptedFields {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @EncryptedProperty({ type: t.string })
  ssn!: string;

  @EncryptedProperty({ type: t.string })
  creditCard!: string;
}

@Entity()
class ParentEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @EncryptedProperty({ type: t.string })
  parentSecret!: string;
}

@Entity()
class ChildEntity extends ParentEntity {
  @EncryptedProperty({ type: t.string })
  childSecret!: string;
}

@Entity()
class UserWithNullableEncryptedField {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @EncryptedProperty({ type: t.string, nullable: true })
  ssn?: string | null;
}

@Entity()
class UserWithContextualEncryptedFields {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @EncryptedProperty({ type: t.string, context: "user:ssn" })
  ssn!: string;

  @EncryptedProperty({ type: t.string, context: "user:card" })
  creditCard!: string;

  @EncryptedProperty({ type: t.string })
  plainContextNote!: string;
}

describe("EncryptedProperty", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    CryptService.init(TEST_SECRET);
    orm = await MikroORM.init({
      entities: [
        User,
        UserWithMultipleEncryptedFields,
        ParentEntity,
        ChildEntity,
        UserWithNullableEncryptedField,
        UserWithContextualEncryptedFields,
      ],
      dbName: nextDbName(),
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.schema.clear();
  });

  describe("decorator application", () => {
    it("should throw error when used on symbol property", () => {
      const symbolKey = Symbol("ssn");

      expect(() => {
        const target = {};
        EncryptedProperty()(target, symbolKey);
      }).toThrow(
        "EncryptedProperty decorator can only be used on string properties.",
      );
    });

    it("should throw error when context is empty or whitespace", () => {
      expect(() => EncryptedProperty({ context: "" })).toThrow(
        "EncryptedProperty context must be a non-empty string.",
      );
      expect(() => EncryptedProperty({ context: "   " })).toThrow(
        "EncryptedProperty context must be a non-empty string.",
      );
    });

    it("should not add duplicate properties when decorator is applied twice", async () => {
      @Entity()
      class DuplicateDecoratorEntity {
        @PrimaryKey({ type: t.integer })
        id!: number;

        @EncryptedProperty({ type: t.string })
        @EncryptedProperty() // Applied twice
        ssn!: string;
      }

      const tempOrm = await MikroORM.init({
        entities: [DuplicateDecoratorEntity],
        dbName: nextDbName(),
      });
      await tempOrm.schema.create();

      const em = tempOrm.em.fork();
      const entity = em.create(DuplicateDecoratorEntity, {
        ssn: "123-45-6789",
      });
      em.persist(entity);
      await em.flush();

      // Verify database has encrypted value
      const result = await em
        .getConnection()
        .execute(`SELECT ssn FROM duplicate_decorator_entity WHERE id = ?`, [
          entity.id,
        ]);
      const dbValue = result[0].ssn;
      expect(dbValue.split(".")).toHaveLength(5); // JWE format
      expect(await CryptService.decrypt(dbValue)).toBe("123-45-6789");

      await tempOrm.close(true);
    });

    it("should merge custom options with default options", () => {
      @Entity()
      class CustomOptionsEntity {
        @PrimaryKey({ type: t.integer })
        id!: number;

        @EncryptedProperty({ type: t.string })
        optionalSsn!: string;
      }

      expect(CustomOptionsEntity).toBeDefined();
      expect(CustomOptionsEntity.prototype).toHaveProperty(
        "__encryptProperties__",
      );
    });
  });

  describe("create operations", () => {
    it("should encrypt value in database", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { ssn: "123-45-6789" });
      em.persist(user);
      await em.flush();

      // Verify database has encrypted value (JWE format)
      const result = await em
        .getConnection()
        .execute(`SELECT ssn FROM "user" WHERE id = ?`, [user.id]);
      const dbValue = result[0].ssn;
      expect(dbValue.split(".")).toHaveLength(5); // JWE format
      expect(await CryptService.decrypt(dbValue)).toBe("123-45-6789");
    });

    it("should encrypt multiple properties in database", async () => {
      const em = orm.em.fork();

      const user = em.create(UserWithMultipleEncryptedFields, {
        ssn: "123-45-6789",
        creditCard: "4111-1111-1111-1111",
      });
      em.persist(user);
      await em.flush();

      // Verify database has encrypted values (JWE format)
      const result = await em
        .getConnection()
        .execute(
          `SELECT ssn, credit_card FROM user_with_multiple_encrypted_fields WHERE id = ?`,
          [user.id],
        );
      expect(result[0].ssn.split(".")).toHaveLength(5);
      expect(result[0].credit_card.split(".")).toHaveLength(5);
      expect(await CryptService.decrypt(result[0].ssn)).toBe("123-45-6789");
      expect(await CryptService.decrypt(result[0].credit_card)).toBe(
        "4111-1111-1111-1111",
      );
    });

    it("should encrypt inherited properties in database", async () => {
      const em = orm.em.fork();

      const child = em.create(ChildEntity, {
        parentSecret: "parent-data",
        childSecret: "child-data",
      });
      em.persist(child);
      await em.flush();

      // Verify database has encrypted values (JWE format)
      const result = await em
        .getConnection()
        .execute(
          `SELECT parent_secret, child_secret FROM child_entity WHERE id = ?`,
          [child.id],
        );
      expect(result[0].parent_secret.split(".")).toHaveLength(5);
      expect(result[0].child_secret.split(".")).toHaveLength(5);
    });
  });

  describe("update operations", () => {
    it("should encrypt updated value in database", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { ssn: "111-11-1111" });
      em.persist(user);
      await em.flush();

      // Update the value
      wrap(user).assign({ ssn: "222-22-2222" });
      await em.flush();

      // Verify database has new encrypted value
      const result = await em
        .getConnection()
        .execute(`SELECT ssn FROM "user" WHERE id = ?`, [user.id]);
      expect(await CryptService.decrypt(result[0].ssn)).toBe("222-22-2222");
    });

    it("should not re-encrypt already encrypted value", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { ssn: "123-45-6789" });
      em.persist(user);
      await em.flush();

      // Get the encrypted value from database
      const result1 = await em
        .getConnection()
        .execute(`SELECT ssn FROM "user" WHERE id = ?`, [user.id]);
      const encryptedValue1 = result1[0].ssn;

      // Flush again without any changes
      await em.flush();

      // Value in database should remain the same (no re-encryption)
      const result2 = await em
        .getConnection()
        .execute(`SELECT ssn FROM "user" WHERE id = ?`, [user.id]);
      expect(result2[0].ssn).toBe(encryptedValue1);
    });
  });

  describe("load operations", () => {
    it("should load encrypted value from database", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { ssn: "123-45-6789" });
      em.persist(user);
      await em.flush();

      // Clear the entity manager to force a fresh load
      em.clear();

      // Property is lazy, need to populate it explicitly
      const loadedUser = await em.findOneOrFail(User, user.id, {
        populate: ["ssn"],
      });

      // Loaded value is encrypted (JWE format)
      expect(loadedUser.ssn.split(".")).toHaveLength(5);
    });

    it("should allow manual decryption after load", async () => {
      const em = orm.em.fork();

      const user = em.create(User, { ssn: "123-45-6789" });
      em.persist(user);
      await em.flush();

      em.clear();

      // Property is lazy, need to populate it explicitly
      const loadedUser = await em.findOneOrFail(User, user.id, {
        populate: ["ssn"],
      });

      // Manually decrypt
      const decrypted = await CryptService.decrypt(loadedUser.ssn);
      expect(decrypted).toBe("123-45-6789");
    });
  });

  describe("edge cases", () => {
    it("should skip encryption for non-string values", async () => {
      const encryptPropertiesMethod = (
        User.prototype as unknown as {
          __encryptProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__encryptProperties__;

      const mockUser = { ssn: 12345 };

      await encryptPropertiesMethod.call(mockUser, {
        changeSet: { payload: { ssn: 12345 } },
      } as unknown as EventArgs<User>);

      // Should remain unchanged
      expect(mockUser.ssn).toBe(12345);
    });

    it("should skip already encrypted values (JWE format)", async () => {
      const encryptPropertiesMethod = (
        User.prototype as unknown as {
          __encryptProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__encryptProperties__;

      const encrypted = await CryptService.encrypt("secret");
      const mockUser = { ssn: encrypted };

      await encryptPropertiesMethod.call(mockUser, {
        changeSet: { payload: { ssn: encrypted } },
      } as unknown as EventArgs<User>);

      // Should remain unchanged (not double-encrypted)
      expect(mockUser.ssn).toBe(encrypted);
    });

    it("should handle undefined changeSet gracefully", async () => {
      const encryptPropertiesMethod = (
        User.prototype as unknown as {
          __encryptProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__encryptProperties__;

      const mockUser = { ssn: "123-45-6789" };

      await encryptPropertiesMethod.call(mockUser, {} as EventArgs<User>);

      // Value should remain unchanged when changeSet is undefined
      expect(mockUser.ssn).toBe("123-45-6789");
    });

    it("should handle missing metadata gracefully", async () => {
      const encryptPropertiesMethod = (
        User.prototype as unknown as {
          __encryptProperties__: (args: EventArgs<User>) => Promise<void>;
        }
      ).__encryptProperties__;

      const mockInstance = Object.create(null) as Record<string, unknown>;
      Object.setPrototypeOf(mockInstance, {});

      await encryptPropertiesMethod.call(mockInstance, {} as EventArgs<User>);

      expect(mockInstance.ssn).toBeUndefined();
    });
  });

  describe("metadata handling", () => {
    it("should define __encryptProperties__ method on prototype", () => {
      expect(User.prototype).toHaveProperty("__encryptProperties__");
      expect(
        typeof (User.prototype as unknown as Record<string, unknown>)
          .__encryptProperties__,
      ).toBe("function");
    });

    it("should not share metadata between parent and child classes", () => {
      expect(
        Object.prototype.hasOwnProperty.call(
          ParentEntity.prototype,
          "__encryptProperties__",
        ),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(
          ChildEntity.prototype,
          "__encryptProperties__",
        ),
      ).toBe(true);
    });
  });

  describe("query operations with null/not null", () => {
    it("should be able to query for null encrypted field", async () => {
      const em = orm.em.fork();

      // Create user with null ssn
      const userWithNull = em.create(UserWithNullableEncryptedField, {
        ssn: null,
      });
      em.persist(userWithNull);

      // Create user with ssn
      const userWithSsn = em.create(UserWithNullableEncryptedField, {
        ssn: "123-45-6789",
      });
      em.persist(userWithSsn);

      await em.flush();
      em.clear();

      // Query for null ssn (property is lazy, need to populate)
      const foundNull = await em.findOne(
        UserWithNullableEncryptedField,
        {
          ssn: null,
        },
        {
          populate: ["ssn"],
        },
      );

      expect(foundNull).not.toBeNull();
      expect(foundNull?.id).toBe(userWithNull.id);
      expect(foundNull?.ssn).toBeNull();
    });

    it("should be able to query for not null encrypted field", async () => {
      const em = orm.em.fork();

      // Create user with null ssn
      const userWithNull = em.create(UserWithNullableEncryptedField, {
        ssn: null,
      });
      em.persist(userWithNull);

      // Create user with ssn
      const userWithSsn = em.create(UserWithNullableEncryptedField, {
        ssn: "123-45-6789",
      });
      em.persist(userWithSsn);

      await em.flush();
      em.clear();

      // Query for not null ssn (property is lazy, need to populate)
      const foundNotNull = await em.findOne(
        UserWithNullableEncryptedField,
        {
          ssn: { $ne: null },
        },
        {
          populate: ["ssn"],
        },
      );

      expect(foundNotNull).not.toBeNull();
      expect(foundNotNull?.id).toBe(userWithSsn.id);
      // Value is encrypted
      expect(foundNotNull?.ssn?.split(".")).toHaveLength(5);
    });
  });

  describe("context domain separation", () => {
    it("should isolate keys per property context on create and update while keeping default properties unscoped", async () => {
      const em = orm.em.fork();

      const user = em.create(UserWithContextualEncryptedFields, {
        ssn: "123-45-6789",
        creditCard: "4111-1111-1111-1111",
        plainContextNote: "root-note",
      });
      em.persist(user);
      await em.flush();

      const [row] = await em.getConnection().execute<
        {
          ssn: string;
          credit_card: string;
          plain_context_note: string;
        }[]
      >(`SELECT ssn, credit_card, plain_context_note FROM user_with_contextual_encrypted_fields WHERE id = ?`, [user.id]);

      expect(await CryptService.decrypt(row.ssn, { context: "user:ssn" })).toBe(
        "123-45-6789",
      );
      expect(
        await CryptService.decrypt(row.credit_card, { context: "user:card" }),
      ).toBe("4111-1111-1111-1111");
      expect(await CryptService.decrypt(row.plain_context_note)).toBe(
        "root-note",
      );

      // Cross-context and root decryption must fail
      await expect(CryptService.decrypt(row.ssn)).rejects.toThrow();
      await expect(
        CryptService.decrypt(row.ssn, { context: "user:card" }),
      ).rejects.toThrow();
      await expect(
        CryptService.decrypt(row.plain_context_note, { context: "user:ssn" }),
      ).rejects.toThrow();

      // Update contextual property and verify new ciphertext still uses the configured context
      wrap(user).assign({ ssn: "999-99-9999" });
      await em.flush();

      const [updatedRow] = await em
        .getConnection()
        .execute<
          { ssn: string }[]
        >(`SELECT ssn FROM user_with_contextual_encrypted_fields WHERE id = ?`, [user.id]);
      expect(
        await CryptService.decrypt(updatedRow.ssn, { context: "user:ssn" }),
      ).toBe("999-99-9999");
      await expect(CryptService.decrypt(updatedRow.ssn)).rejects.toThrow();
    });

    it("should preserve context on duplicate decoration and allow subclasses to override parent context back to root", async () => {
      @Entity()
      class BaseContextualEntity {
        @PrimaryKey({ type: t.integer })
        id!: number;

        @EncryptedProperty({ type: t.string, context: "base:secret" })
        secret!: string;
      }

      @Entity()
      class DerivedUnscopedEntity extends BaseContextualEntity {
        @EncryptedProperty({ type: t.string })
        override secret: Opt<string> = "";

        @EncryptedProperty({ type: t.string, context: "dup:outer" })
        @EncryptedProperty()
        outerToken!: string;

        @EncryptedProperty({ type: t.string })
        @EncryptedProperty({ type: t.string, context: "dup:inner" })
        innerToken!: string;
      }

      const tempOrm = await MikroORM.init({
        entities: [BaseContextualEntity, DerivedUnscopedEntity],
        dbName: nextDbName(),
      });
      await tempOrm.schema.create();

      const em = tempOrm.em.fork();
      const base = em.create(BaseContextualEntity, { secret: "base-val" });
      const derived = em.create(DerivedUnscopedEntity, {
        secret: "derived-val",
        outerToken: "outer-val",
        innerToken: "inner-val",
      });
      em.persist([base, derived]);
      await em.flush();

      const [baseRow] = await em
        .getConnection()
        .execute<
          { secret: string }[]
        >(`SELECT secret FROM base_contextual_entity WHERE id = ?`, [base.id]);
      const [derivedRow] = await em
        .getConnection()
        .execute<
          { secret: string; outer_token: string; inner_token: string }[]
        >(`SELECT secret, outer_token, inner_token FROM derived_unscoped_entity WHERE id = ?`, [derived.id]);

      // Base entity still uses "base:secret"
      expect(
        await CryptService.decrypt(baseRow.secret, { context: "base:secret" }),
      ).toBe("base-val");
      await expect(CryptService.decrypt(baseRow.secret)).rejects.toThrow();

      // Derived entity overrode secret to unscoped root key, and preserved contexts across both duplicate decorator orders
      expect(await CryptService.decrypt(derivedRow.secret)).toBe("derived-val");
      await expect(
        CryptService.decrypt(derivedRow.secret, { context: "base:secret" }),
      ).rejects.toThrow();
      expect(
        await CryptService.decrypt(derivedRow.outer_token, {
          context: "dup:outer",
        }),
      ).toBe("outer-val");
      expect(
        await CryptService.decrypt(derivedRow.inner_token, {
          context: "dup:inner",
        }),
      ).toBe("inner-val");

      await tempOrm.close(true);
    });
  });
});
