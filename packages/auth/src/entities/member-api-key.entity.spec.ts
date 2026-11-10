import { MetadataStorage, t } from "@mikro-orm/core";

import { Member } from "./member.entity.js";
import { MemberApiKey } from "./member-api-key.entity.js";

describe("row-level policies", () => {
  describe("auth entity policies and uniqueness", () => {
    it("uses the same owner-scope predicate for reads and writes", () => {
      const policies = Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === MemberApiKey,
      )?.policies;
      expect(policies).toEqual([
        {
          command: "all",
          roles: ["authenticated"],
          using: expect.any(Function),
          check: expect.any(Function),
        },
      ]);
      expect(policies?.[0].using).toBe(policies?.[0].check);
    });
  });
});

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([[MemberApiKey, "member", "workspace"]] as const)(
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
    it.each([MemberApiKey])(
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
      [MemberApiKey, "member", Member, { ref: true, deleteRule: "cascade" }],
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
    const entity = new MemberApiKey();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity).not.toHaveProperty("user");
    expect(entity.member).toBeUndefined();
    expect(entity).not.toHaveProperty("owner");
    expect(entity.enabled).toBe(true);
    expect(entity.permissions).toEqual([]);
  });

  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === MemberApiKey,
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
