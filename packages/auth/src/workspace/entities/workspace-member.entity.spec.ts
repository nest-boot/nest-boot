import { MetadataStorage, t } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "./workspace.entity.js";
import { WorkspaceMember } from "./workspace-member.entity.js";

describe("row-level policies", () => {
  describe("auth entity policies and uniqueness", () => {
    it("combines own-membership reads with workspace isolation", () => {
      const policies = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === WorkspaceMember,
      )?.policies;
      expect(policies).toHaveLength(2);
      expect(policies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: "select",
            roles: ["authenticated"],
            using: expect.any(Function),
          }),
          expect.objectContaining({
            command: "all",
            roles: ["authenticated"],
            using: expect.any(Function),
            check: expect.any(Function),
          }),
        ]),
      );
    });
    it("requires unique membership identities, not contact emails", () => {
      const uniques = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === WorkspaceMember,
      )?.uniques;
      expect(uniques).toEqual([
        expect.objectContaining({ properties: ["user", "workspace"] }),
      ]);
    });
  });
});

describe("entity metadata", () => {
  describe("auth entities", () => {
    it("persists workspace-visible member profile fields", () => {
      const properties = (entity: object) =>
        Object.values(MetadataStorage.getMetadata()).find(
          (meta) => meta.class === entity,
        )?.properties;
      expect(properties(WorkspaceMember)?.name).toMatchObject({
        name: "name",
      });
      expect(properties(WorkspaceMember)?.email).toMatchObject({
        name: "email",
        nullable: true,
      });
    });
    it.each([WorkspaceMember])(
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
      [WorkspaceMember, "user", User, { deleteRule: "cascade" }],
      [WorkspaceMember, "workspace", Workspace, { deleteRule: "cascade" }],
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
    const entity = new WorkspaceMember();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity.permissions).toEqual([]);
    expect(entity.roles).toEqual(["member"]);
    expect(entity.status).toBe("ACTIVE");
    expect(entity.email).toBeNull();
    expect(entity.type).toBe("USER");
  });

  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === WorkspaceMember,
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
