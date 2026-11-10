import { Collection, MetadataStorage } from "@mikro-orm/core";

import { Member } from "./member.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("row-level policies", () => {
  describe("auth entity policies and uniqueness", () => {
    it("scopes workspace updates and permanent deletion to the selected workspace", () => {
      expect(
        Object.values(MetadataStorage.getMetadata()).find(
          (meta) => meta.class === Workspace,
        )?.policies,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: "update",
            roles: ["authenticated"],
            using: expect.any(Function),
            check: expect.any(Function),
          }),
          expect.objectContaining({
            command: "delete",
            roles: ["authenticated"],
            using: expect.any(Function),
          }),
        ]),
      );
    });
    it("allows public workspace reads through row-level security", () => {
      expect(
        Object.values(MetadataStorage.getMetadata()).find(
          (meta) => meta.class === Workspace,
        )?.policies,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: "select",
            using: expect.any(Function),
            roles: ["authenticated", "anonymous"],
          }),
        ]),
      );
    });
  });
});

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([Workspace])(
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
      [Workspace, "members", Member, { mappedBy: "workspace" }],
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
    const entity = new Workspace();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity).not.toHaveProperty("deletedAt");
    expect(entity.members).toBeInstanceOf(Collection);
    expect(entity).not.toHaveProperty("features");
  });
});
