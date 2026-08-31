import { validateSync } from "class-validator";

import { IS_LENGTH, Length } from "./length.decorator.js";

vi.mock("@nest-boot/i18n", () => ({
  t: (key: string): string => key,
}));

class MinimumLengthFixture {
  @Length(2)
  value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }
}

class BoundedLengthFixture {
  @Length(2, 4)
  value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }
}

describe("Length", () => {
  it.each([null, undefined, 1, {}, []])(
    "returns a validation error for the non-string value %p",
    (value) => {
      const errors = validateSync(new MinimumLengthFixture(value));

      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints).toEqual({
        [IS_LENGTH]: "validation:length.gte",
      });
    },
  );

  it("keeps the bounded-length message for a bounded constraint", () => {
    const errors = validateSync(new BoundedLengthFixture(null));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual({
      [IS_LENGTH]: "validation:length.between",
    });
  });
});
