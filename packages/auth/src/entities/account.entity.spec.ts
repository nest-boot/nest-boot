import { MetadataStorage } from "@mikro-orm/core";

import { Account } from "./account.entity.js";
import { User } from "./user.entity.js";

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([Account])(
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
      [Account, "user", User, { ref: true, deleteRule: "cascade" }],
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
    const entity = new Account();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
  });

  describe("auth entities", () => {
    it.each([
      [undefined, []],
      ["", []],
      ["openid", ["openid"]],
      ["openid,profile,email", ["openid", "profile", "email"]],
      ["openid profile\temail", ["openid", "profile", "email"]],
      [" , openid, profile\nemail ,, ", ["openid", "profile", "email"]],
    ] as const)("parses persisted OAuth scopes %j", (scope, expected) => {
      const account = Object.assign(new Account(), { scope });
      expect(account.scopes).toEqual(expected);
    });
  });
});
