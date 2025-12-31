import "reflect-metadata";

import {
  Entity,
  EventArgs,
  MikroORM,
  PrimaryKey,
  t,
  wrap,
} from "@mikro-orm/better-sqlite";
import { CryptService } from "@nest-boot/crypt";

import { EncryptedProperty } from ".";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

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
      ],
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
      const symbolKey = Symbol("ssn");

      expect(() => {
        const target = {};
        EncryptedProperty()(target, symbolKey);
      }).toThrow(
        "EncryptedProperty decorator can only be used on string properties.",
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
        dbName: ":memory:",
      });
      await tempOrm.schema.createSchema();

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
        .execute(`SELECT ssn FROM user WHERE id = ?`, [user.id]);
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
        .execute(`SELECT ssn FROM user WHERE id = ?`, [user.id]);
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
        .execute(`SELECT ssn FROM user WHERE id = ?`, [user.id]);
      const encryptedValue1 = result1[0].ssn;

      // Flush again without any changes
      await em.flush();

      // Value in database should remain the same (no re-encryption)
      const result2 = await em
        .getConnection()
        .execute(`SELECT ssn FROM user WHERE id = ?`, [user.id]);
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
});
