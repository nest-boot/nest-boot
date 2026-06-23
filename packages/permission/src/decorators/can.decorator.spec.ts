import { SetMetadata } from "@nestjs/common";

import { PermissionAction } from "../enums/permission-action.enum.js";
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
    expect(Can(PermissionAction.READ, Subject)).toEqual({
      key: CAN_METADATA,
      value: {
        action: PermissionAction.READ,
        subject: Subject,
      },
    });
  });

  it("stores subject factory as positional subject argument", () => {
    const subjectFactory = vi.fn();

    expect(Can(PermissionAction.READ, subjectFactory)).toEqual({
      key: CAN_METADATA,
      value: {
        action: PermissionAction.READ,
        subject: subjectFactory,
      },
    });
  });

  it("stores full permission options when an options object is provided", () => {
    const options = {
      action: PermissionAction.UPDATE,
      subject: Subject,
    };

    expect(Can(options)).toEqual({
      key: CAN_METADATA,
      value: options,
    });
  });

  it("throws when positional arguments omit the subject", () => {
    expect(() => Can(PermissionAction.READ as never)).toThrow(
      "Permission subject is required.",
    );
    expect(SetMetadata).not.toHaveBeenCalled();
  });
});
