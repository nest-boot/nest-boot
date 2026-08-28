import { validateSync } from "class-validator";

import {
  IsDate,
  isDate,
  IsDomain,
  IsEmail,
  isEmail,
  IsNumberString,
  isNumberString,
  IsTimezone,
  IsUrl,
  isURL,
  length,
} from "../../index";

jest.mock("@nest-boot/i18n", () => ({
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

describe("string validation helpers", () => {
  it("validates email addresses", () => {
    expect(isEmail("user@example.com")).toBe(true);
    expect(isEmail("not-an-email")).toBe(false);
    expect(isEmail(1)).toBe(false);
  });

  it("validates numeric strings", () => {
    expect(isNumberString("123.45")).toBe(true);
    expect(isNumberString("abc")).toBe(false);
    expect(isNumberString(123)).toBe(false);
  });

  it("validates URLs", () => {
    expect(isURL("https://example.com/path")).toBe(true);
    expect(isURL("not-a-url")).toBe(false);
    expect(isURL(1 as never)).toBe(false);
  });

  it("validates string lengths", () => {
    expect(length("ab", 2, 3)).toBe(true);
    expect(length("a", 2, 3)).toBe(false);
    expect(length(null, 2, 3)).toBe(false);
  });
});

describe("string decorators", () => {
  it.each([
    {
      name: "domain",
      decorator: IsDomain(),
      valid: "example.com",
      invalid: "localhost",
      constraint: "IsDomain",
      message: "validation:is-domain",
    },
    {
      name: "email",
      decorator: IsEmail(),
      valid: "user@example.com",
      invalid: "not-an-email",
      constraint: "isEmail",
      message: "validation:is-email",
    },
    {
      name: "numeric string",
      decorator: IsNumberString(),
      valid: "123.45",
      invalid: "abc",
      constraint: "isNumberString",
      message: "validation:is-number-string",
    },
    {
      name: "timezone",
      decorator: IsTimezone(),
      valid: "America/Los_Angeles",
      invalid: "Mars/Olympus_Mons",
      constraint: "isTimezone",
      message: "validation:is-timezone",
    },
    {
      name: "URL",
      decorator: IsUrl(),
      valid: "https://example.com/path",
      invalid: "not-a-url",
      constraint: "isUrl",
      message: "validation:is-url",
    },
  ])("validates $name values", (testCase) => {
    expect(validateValue(testCase.decorator, testCase.valid)).toHaveLength(0);
    expect(
      validateValue(testCase.decorator, testCase.invalid)[0]?.constraints,
    ).toEqual({
      [testCase.constraint]: testCase.message,
    });
  });

  it("rejects non-string domain and timezone values", () => {
    expect(validateValue(IsDomain(), null)).toHaveLength(1);
    expect(validateValue(IsTimezone(), null)).toHaveLength(1);
  });
});

describe("date validation", () => {
  it("accepts valid dates", () => {
    const value = new Date("2026-08-28T00:00:00.000Z");

    expect(isDate(value)).toBe(true);
    expect(validateValue(IsDate(), value)).toHaveLength(0);
  });

  it("rejects invalid dates and other value types", () => {
    expect(isDate(new Date(Number.NaN))).toBe(false);
    expect(isDate("2026-08-28")).toBe(false);
    expect(validateValue(IsDate(), "2026-08-28")[0]?.constraints).toEqual({
      isDate: "validation:is-date",
    });
  });
});
