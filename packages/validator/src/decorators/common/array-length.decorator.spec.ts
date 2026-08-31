import { validateSync } from "class-validator";

import {
  ArrayLength,
  type ArrayLengthOptions,
} from "./array-length.decorator.js";

vi.mock("@nest-boot/i18n", () => ({
  t: (key: string): string => key,
}));

function validateValue(options: ArrayLengthOptions, value: unknown) {
  class Fixture {
    value: unknown;
  }

  ArrayLength(options)(Fixture.prototype, "value");

  const fixture = new Fixture();
  fixture.value = value;
  return validateSync(fixture);
}

describe("ArrayLength", () => {
  it("accepts arrays within the configured bounds", () => {
    expect(validateValue({ min: 1, max: 2 }, [1])).toHaveLength(0);
    expect(validateValue({}, [])).toHaveLength(0);
  });

  it("uses the bounded message when both limits are configured", () => {
    const errors = validateValue({ min: 2, max: 3 }, [1]);

    expect(errors[0]?.constraints).toEqual({
      arrayLength: "validation:arrayLength.between",
    });
  });

  it("uses the minimum message when an array is too short", () => {
    const errors = validateValue({ min: 2 }, [1]);

    expect(errors[0]?.constraints).toEqual({
      arrayLength: "validation:arrayLength.gte",
    });
  });

  it("uses the maximum message when an array is too long", () => {
    const errors = validateValue({ max: 1 }, [1, 2]);

    expect(errors[0]?.constraints).toEqual({
      arrayLength: "validation:arrayLength.lte",
    });
  });

  it("uses the array type message for non-array values", () => {
    const errors = validateValue({ min: 1 }, "not-an-array");

    expect(errors[0]?.constraints).toEqual({
      arrayLength: "validation:is-array",
    });
  });
});
