import {
  EntityProperty,
  Platform,
  Type,
  ValidationError,
} from "@mikro-orm/core";

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

  it.each([0, -1, 1.5, NaN, Infinity])(
    "should reject invalid dimensions: %s",
    (dimensions) => {
      expect(() =>
        new VectorType(dimensions).getColumnType(property, platform),
      ).toThrow("Vector dimensions must be a positive integer");
    },
  );

  it("should validate dimensions provided by property metadata", () => {
    const prop = { dimensions: 1.5 } as unknown as EntityProperty;

    expect(() => new VectorType(3).getColumnType(prop, platform)).toThrow(
      "Vector dimensions must be a positive integer",
    );
  });

  it.each([null, undefined])(
    "should allow property dimensions of %s to disable configured dimensions",
    (dimensions) => {
      const prop = { dimensions } as unknown as EntityProperty;

      expect(new VectorType(3).getColumnType(prop, platform)).toBe("vector");
    },
  );

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

  it("should preserve undefined values", () => {
    const type = new VectorType();

    expect(type.convertToDatabaseValue(undefined, platform)).toBeUndefined();
    expect(type.convertToJSValue(undefined, platform)).toBeUndefined();
  });

  it.each([true, false])("should reject boolean vector values: %s", (value) => {
    const type = new VectorType();
    const invalid = value as unknown as number[];

    expect(() => type.convertToDatabaseValue(invalid, platform)).toThrow(
      ValidationError,
    );
    expect(() =>
      type.convertToDatabaseValue(invalid, platform, {
        fromQuery: true,
        key: "$eq",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      type.convertToDatabaseValue(invalid, platform, { key: "$exists" }),
    ).toThrow(ValidationError);
  });

  it("should parse whitespace and scientific notation", () => {
    expect(
      new VectorType().convertToJSValue(" [ 1e-3, -2.5, 0 ] ", platform),
    ).toEqual([0.001, -2.5, 0]);
  });

  it.each(
    [
      [],
      [NaN],
      [Infinity],
      [-Infinity],
      [1, undefined],
      ["1", "2"],
      new Array(2),
      "[1,2]",
    ].map((value) => ({ value })),
  )("should reject invalid vector input: $value", ({ value }) => {
    expect(() =>
      new VectorType().convertToDatabaseValue(value as number[], platform),
    ).toThrow(ValidationError);
  });

  it.each(["[]", "[1oops]", "[NaN]", "[1e400]", "[null]", "[1,]", "{}", '"x"'])(
    "should reject invalid database vector text: %s",
    (value) => {
      expect(() => new VectorType().convertToJSValue(value, platform)).toThrow(
        ValidationError,
      );
    },
  );
});
