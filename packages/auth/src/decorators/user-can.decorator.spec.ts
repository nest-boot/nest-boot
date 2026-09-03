import { USER_CAN_METADATA } from "../permission.constants.js";
import { UserCan } from "./user-can.decorator.js";

describe("UserCan", () => {
  it("stores user-scoped action and subject metadata", () => {
    const subjectFactory = vi.fn();
    const decorator = UserCan("read", subjectFactory);
    class Controller {}

    decorator(Controller);

    expect(decorator.KEY).toBe(USER_CAN_METADATA);
    expect(Reflect.getMetadata(USER_CAN_METADATA, Controller)).toEqual({
      action: "read",
      subject: subjectFactory,
    });
  });

  it("requires a subject", () => {
    expect(() => UserCan("read")).toThrow("Permission subject is required.");
  });
});
