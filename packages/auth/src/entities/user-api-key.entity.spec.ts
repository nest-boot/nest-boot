import { MetadataStorage, t } from "@mikro-orm/core";

import { User } from "./user.entity.js";
import { UserApiKey } from "./user-api-key.entity.js";

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([[UserApiKey, "user", "workspace"]] as const)(
      "gives %s only its required owner relation",
      (entity, owner, other) => {
        const metadata = Object.values(MetadataStorage.getMetadata()).find(
          (meta) => meta.class === entity,
        );
        expect(
          Object.values(metadata?.properties ?? {}).find(
            (property) => property.name === owner,
          )?.nullable ?? false,
        ).toBe(false);
        expect(
          Object.values(metadata?.properties ?? {}).find(
            (property) => property.name === other,
          ),
        ).toBeUndefined();
        expect(metadata?.checks ?? []).toEqual([]);
      },
    );
    it.each([UserApiKey])(
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
    it.each([
      [UserApiKey, "user", User, { ref: true, deleteRule: "cascade" }],
    ] as const)(
      "%s.%s targets the built-in class",
      (entity, field, target, options) => {
        const metadata = Object.values(MetadataStorage.getMetadata());
        const property = Object.values(
          metadata.find((meta) => meta.class === entity)?.properties ?? {},
        ).find((property) => property.name === field);
        expect(property).toMatchObject(options);
        expect(property?.cascade ?? []).not.toContain("remove");
        if (typeof property?.entity !== "function") {
          throw new Error("Missing class relation");
        }
        expect(property.entity()).toBe(target);
      },
    );
  });
});

describe("entity defaults", () => {
  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === UserApiKey,
    );
    for (const field of ["permissions"]) {
      expect(
        Object.values(metadata?.properties ?? {}).find(
          (property) => property.name === field,
        )?.type,
      ).toBe(t.array);
    }
  });
});
