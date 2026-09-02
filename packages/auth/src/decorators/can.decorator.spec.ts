import { SetMetadata } from "@nestjs/common";

import { CAN_METADATA } from "../permission.constants.js";
import { Can } from "./can.decorator.js";

vi.mock("@nestjs/common", () => ({
  SetMetadata: vi.fn((key, value) => ({ key, value })),
}));

class Subject {}

describe("Can", () => {
  beforeEach(() => {
    vi.mocked(SetMetadata).mockClear();
  });

  it("stores action and subject metadata from positional arguments", () => {
    expect(Can("read", Subject)).toEqual({
      key: CAN_METADATA,
      value: {
        action: "read",
        scope: "workspace",
        subject: Subject,
      },
    });
  });

  it("stores an explicit scope with a subject factory", () => {
    const subjectFactory = vi.fn();

    expect(
      Can("read", subjectFactory, {
        scope: "user",
      }),
    ).toEqual({
      key: CAN_METADATA,
      value: {
        action: "read",
        scope: "user",
        subject: subjectFactory,
      },
    });
  });

  it("throws when positional arguments omit the subject", () => {
    expect(() => Can("read")).toThrow("Permission subject is required.");
    expect(SetMetadata).not.toHaveBeenCalled();
  });
});
