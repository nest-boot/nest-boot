import { MetadataStorage, t } from "@mikro-orm/core";

import { Invitation } from "./invitation.entity.js";
import { User } from "./user.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("entity metadata", () => {
  describe("built-in auth entity field ownership", () => {
    it.each([
      [Invitation, "inviter", User, { deleteRule: "cascade" }],
      [Invitation, "workspace", Workspace, { deleteRule: "cascade" }],
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
  it("initializes generated ids, timestamps and defaults", () => {
    const entity = new Invitation();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity.status).toBe("pending");
  });

  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === Invitation,
    );
    for (const field of ["roles"]) {
      expect(
        Object.values(metadata?.properties ?? {}).find(
          (property) => property.name === field,
        )?.type,
      ).toBe(t.array);
    }
  });
});
