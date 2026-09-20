import { CAN_METADATA } from "../permission.constants.js";
import { Can } from "./can.decorator.js";

class Subject {}

describe("Can", () => {
  it("stores action and subject metadata on a class", () => {
    class Controller {}
    const decorator = Can("read", Subject);
    decorator(Controller);
    expect(decorator.KEY).toBe(CAN_METADATA);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
    ]);
  });

  it("stores subject factories on a method", () => {
    const factory = vi.fn();
    const handler = vi.fn();
    class Controller {}
    Can("read", factory)(Controller.prototype, "handle", { value: handler });
    expect(Reflect.getMetadata(CAN_METADATA, handler)).toEqual([
      { action: "read", subject: factory },
    ]);
  });

  it("appends repeated requirements using all semantics", () => {
    class Controller {}
    Can("read", Subject)(Controller);
    Can("update", Subject)(Controller);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
      { action: "update", subject: Subject },
    ]);
  });

  it("requires a subject", () => {
    expect(() => {
      // @ts-expect-error Deliberately omit the subject to verify runtime validation.
      return Can("read");
    }).toThrow("Permission subject is required.");
  });
});
