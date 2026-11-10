import { MetadataStorage } from "@mikro-orm/core";

import { Verification } from "./verification.entity.js";

describe("entity metadata", () => {
  describe("auth entities", () => {
    it.each([Verification])(
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
});

describe("entity defaults", () => {
  it("initializes generated ids, timestamps and defaults", () => {
    const entity = new Verification();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
  });
});
