import { MetadataStorage, t } from "@mikro-orm/core";

import { User } from "./user.entity.js";

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([User])(
      "%s refreshes its update timestamp through real ORM metadata",
      (entity) => {
        const property = Object.values(MetadataStorage.getMetadata()).find(
          (meta) => meta.class === entity,
        )?.properties.updatedAt;
        expect(property?.onUpdate).toEqual(expect.any(Function));
        expect(property?.onUpdate?.(new entity(), {} as never)).toBeInstanceOf(
          Date,
        );
      },
    );
  });
  describe("built-in auth entity field ownership", () => {
    it("keeps workspace relations out of the core user metadata", () => {
      const metadata = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === User,
      );
      expect(metadata?.properties).not.toHaveProperty("members");
    });
  });
});

describe("entity defaults", () => {
  it("initializes generated ids, timestamps and defaults", () => {
    const entity = new User();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity.permissions).toEqual([]);
    expect(entity.roles).toEqual(["user"]);
    expect(entity.banned).toBe(false);
    expect(entity.banReason).toBeNull();
    expect(entity.banExpiresAt).toBeNull();
    expect(entity).not.toHaveProperty("members");
  });

  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === User,
    );
    for (const field of ["roles", "permissions"]) {
      expect(
        Object.values(metadata?.properties ?? {}).find(
          (property) => property.name === field,
        )?.type,
      ).toBe(t.array);
    }
  });
});
