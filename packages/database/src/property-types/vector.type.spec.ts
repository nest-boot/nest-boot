import { EntityProperty, Platform, Type } from "@mikro-orm/core";

import { VectorType } from "./vector.type.js";

describe("VectorType", () => {
  const platform = {} as Platform;
  const property = {} as EntityProperty;

  it("should be a MikroORM mapped type", () => {
    const type = new VectorType(3);

    expect(type).toBeInstanceOf(Type);
    expect(Type.isMappedType(type)).toBe(true);
  });

  it("should use configured dimensions", () => {
    expect(new VectorType(1536).getColumnType(property, platform)).toBe(
      "vector(1536)",
    );
  });

  it("should allow property dimensions to override configured dimensions", () => {
    const prop = { dimensions: 768 } as unknown as EntityProperty;

    expect(new VectorType().getColumnType(prop, platform)).toBe("vector(768)");
    expect(new VectorType(1536).getColumnType(prop, platform)).toBe(
      "vector(768)",
    );
  });

  it("should support vectors without dimensions", () => {
    expect(new VectorType().getColumnType(property, platform)).toBe("vector");
  });

  it("should reject non-integer dimensions", () => {
    expect(() => new VectorType(1.5).getColumnType(property, platform)).toThrow(
      "expected integer",
    );
  });

  it("should round-trip vectors through their database representation", () => {
    const type = new VectorType(3);
    const vector = [1, -2.5, 0];
    const value = type.convertToDatabaseValue(vector, platform);

    expect(value).toBe("[1,-2.5,0]");
    expect(type.convertToJSValue(value, platform)).toEqual(vector);
  });

  it("should preserve null values", () => {
    const type = new VectorType();

    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
    expect(type.convertToJSValue(null, platform)).toBeNull();
  });
});
