import { validateSync, type ValidationOptions } from "class-validator";

import {
  IsGreaterThan,
  IsGreaterThanOrEqual,
  IsLessThan,
  IsLessThanOrEqual,
  Max,
  Min,
} from "../../index.js";
import {
  Comparator,
  ValidateCompareNumber,
} from "./validate-compare-number.decorator.js";

vi.mock("@nest-boot/i18n", () => ({
  t: (key: string): string => key,
}));

function validateValue(decorator: PropertyDecorator, value: unknown) {
  class Fixture {
    value: unknown;
  }

  decorator(Fixture.prototype, "value");

  const fixture = new Fixture();
  fixture.value = value;
  return validateSync(fixture);
}

function validateComparison(
  decorator: PropertyDecorator,
  value: unknown,
  reference: unknown,
) {
  class Fixture {
    reference: unknown;
    value: unknown;
  }

  decorator(Fixture.prototype, "value");

  const fixture = new Fixture();
  fixture.reference = reference;
  fixture.value = value;
  return validateSync(fixture);
}

describe("numeric bounds", () => {
  it("validates minimum values after numeric coercion", () => {
    expect(validateValue(Min(2), "2")).toHaveLength(0);
    expect(validateValue(Min(2), 1)[0]?.constraints).toEqual({
      min: "validation:min",
    });
  });

  it("validates maximum values after numeric coercion", () => {
    expect(validateValue(Max(2), "2")).toHaveLength(0);
    expect(validateValue(Max(2), 3)[0]?.constraints).toEqual({
      max: "validation:max",
    });
  });
});

describe("numeric comparisons", () => {
  const cases: {
    createDecorator: (
      field: string,
      options?: ValidationOptions,
    ) => PropertyDecorator;
    failing: number;
    message: string;
    name: string;
    passing: number;
    reference: number;
  }[] = [
    {
      name: "greater than",
      createDecorator: IsGreaterThan,
      reference: 2,
      passing: 3,
      failing: 2,
      message: "validation:is-gt",
    },
    {
      name: "greater than or equal",
      createDecorator: IsGreaterThanOrEqual,
      reference: 2,
      passing: 2,
      failing: 1,
      message: "validation:is-gte",
    },
    {
      name: "less than",
      createDecorator: IsLessThan,
      reference: 2,
      passing: 1,
      failing: 2,
      message: "validation:is-lt",
    },
    {
      name: "less than or equal",
      createDecorator: IsLessThanOrEqual,
      reference: 2,
      passing: 2,
      failing: 3,
      message: "validation:is-lte",
    },
  ];

  it.each(cases)("validates $name comparisons", (testCase) => {
    const decorator = testCase.createDecorator("reference");

    expect(
      validateComparison(decorator, testCase.passing, testCase.reference),
    ).toHaveLength(0);
    expect(
      validateComparison(
        testCase.createDecorator("reference"),
        testCase.failing,
        testCase.reference,
      )[0]?.constraints,
    ).toEqual({ isGreaterThanOrEqual: testCase.message });
  });

  it("supports equality comparisons", () => {
    expect(
      validateComparison(
        ValidateCompareNumber(Comparator.EQ, "reference"),
        "2",
        2,
      ),
    ).toHaveLength(0);
    expect(
      validateComparison(
        ValidateCompareNumber(Comparator.EQ, "reference"),
        3,
        2,
      ),
    ).toHaveLength(1);
  });

  it("skips comparison when the reference value is absent", () => {
    expect(
      validateComparison(IsGreaterThan("reference"), 1, undefined),
    ).toHaveLength(0);
    expect(
      validateComparison(IsGreaterThan("reference"), 1, null),
    ).toHaveLength(0);
  });

  it("forwards validation options from comparison decorators", () => {
    const errors = validateComparison(
      IsGreaterThan("reference", { message: "custom message" }),
      1,
      2,
    );

    expect(errors[0]?.constraints).toEqual({
      isGreaterThanOrEqual: "custom message",
    });
  });

  it("rejects unsupported comparison operators", () => {
    const errors = validateComparison(
      ValidateCompareNumber("unsupported" as Comparator, "reference"),
      2,
      2,
    );

    expect(errors).toHaveLength(1);
  });
});
