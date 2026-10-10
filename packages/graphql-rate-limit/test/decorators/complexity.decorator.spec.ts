import { Directive } from "@nest-boot/graphql";

import { Complexity } from "../../src/decorators/index.js";

vi.mock("@nest-boot/graphql", () => ({
  Directive: vi.fn(),
}));

describe("Complexity", () => {
  const mockedDirective = vi.mocked(Directive);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a directive with explicit complexity options", () => {
    const decorator = vi.fn();
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
