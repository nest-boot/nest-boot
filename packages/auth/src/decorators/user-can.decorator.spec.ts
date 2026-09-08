import { USER_CAN_METADATA } from "../permission.constants.js";
import { UserCan } from "./user-can.decorator.js";

describe("UserCan", () => {
  it("stores user-scoped action and subject metadata", () => {
    const subjectFactory = vi.fn();
    const decorator = UserCan("read", subjectFactory);
    class Controller {}

    decorator(Controller);

    expect(decorator.KEY).toBe(USER_CAN_METADATA);
    expect(Reflect.getMetadata(USER_CAN_METADATA, Controller)).toEqual([
      {
        action: "read",
        subject: subjectFactory,
      },
    ]);
  });

  it("appends repeated requirements using all semantics", () => {
    class Subject {}
    class Controller {}

    UserCan("read", Subject)(Controller);
    UserCan("update", Subject)(Controller);

    expect(Reflect.getMetadata(USER_CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
      { action: "update", subject: Subject },
    ]);
  });

  it("requires a subject", () => {
    expect(() => {
      // @ts-expect-error Deliberately omit the required subject to test runtime validation.
      return UserCan("read");
    }).toThrow("Permission subject is required.");
  });
});
