import {
  USER_CAN_METADATA,
  WORKSPACE_CAN_METADATA,
} from "../permission.constants.js";
import { Can } from "./can.decorator.js";

class Subject {}

describe("Can", () => {
  it("routes to WorkspaceCan by default", () => {
    const decorator = Can("read", Subject);

    expect(decorator.KEY).toBe(WORKSPACE_CAN_METADATA);
    expect(decorator).toEqual(
      expect.objectContaining({
        KEY: WORKSPACE_CAN_METADATA,
      }),
    );
    expect(
      Reflect.getMetadata(WORKSPACE_CAN_METADATA, decorate(decorator)),
    ).toEqual([
      {
        action: "read",
        subject: Subject,
      },
    ]);
  });

  it("routes an explicit user scope to UserCan", () => {
    const subjectFactory = vi.fn();
    const decorator = Can("read", subjectFactory, { scope: "user" });

    expect(decorator.KEY).toBe(USER_CAN_METADATA);
    expect(Reflect.getMetadata(USER_CAN_METADATA, decorate(decorator))).toEqual(
      [
        {
          action: "read",
          subject: subjectFactory,
        },
      ],
    );
  });

  it("routes an explicit workspace scope to WorkspaceCan", () => {
    const decorator = Can("read", Subject, { scope: "workspace" });

    expect(decorator.KEY).toBe(WORKSPACE_CAN_METADATA);
    expect(
      Reflect.getMetadata(WORKSPACE_CAN_METADATA, decorate(decorator)),
    ).toEqual([
      {
        action: "read",
        subject: Subject,
      },
    ]);
  });

  it("delegates subject validation to the scoped decorator", () => {
    expect(() => Can("read")).toThrow("Permission subject is required.");
  });
});

function decorate(decorator: ReturnType<typeof Can>): object {
  class Controller {}
  decorator(Controller);
  return Controller;
}
