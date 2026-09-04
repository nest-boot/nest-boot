import { WORKSPACE_CAN_METADATA } from "../permission.constants.js";
import { WorkspaceCan } from "./workspace-can.decorator.js";

class Subject {}

describe("WorkspaceCan", () => {
  it("stores workspace-scoped action and subject metadata", () => {
    const decorator = WorkspaceCan("read", Subject);
    class Controller {}

    decorator(Controller);

    expect(decorator.KEY).toBe(WORKSPACE_CAN_METADATA);
    expect(Reflect.getMetadata(WORKSPACE_CAN_METADATA, Controller)).toEqual([
      {
        action: "read",
        subject: Subject,
      },
    ]);
  });

  it("appends repeated requirements using all semantics", () => {
    class Controller {}

    WorkspaceCan("read", Subject)(Controller);
    WorkspaceCan("update", Subject)(Controller);

    expect(Reflect.getMetadata(WORKSPACE_CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
      { action: "update", subject: Subject },
    ]);
  });

  it("requires a subject", () => {
    expect(() => WorkspaceCan("read")).toThrow(
      "Permission subject is required.",
    );
  });
});
