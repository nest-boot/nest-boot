import { Directive } from "@nest-boot/graphql";

import { Complexity } from "../../src/decorators";

jest.mock("@nest-boot/graphql", () => ({
  Directive: jest.fn(),
}));

describe("Complexity", () => {
  const mockedDirective = jest.mocked(Directive);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds a directive with explicit complexity options", () => {
    const decorator = jest.fn();
    mockedDirective.mockReturnValue(decorator);

    expect(Complexity({ value: 5, multipliers: ["first"] })).toBe(decorator);
    expect(mockedDirective).toHaveBeenCalledWith(
      '@complexity(value: 5, multipliers: ["first"])',
    );
  });

  it("uses the default value and multiplier list", () => {
    Complexity({});

    expect(mockedDirective).toHaveBeenCalledWith(
      "@complexity(value: 1, multipliers: [])",
    );
  });
});
