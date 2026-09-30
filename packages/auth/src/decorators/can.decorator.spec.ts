import { CAN_METADATA } from "../permission.constants.js";
import type { CanSubjectCallback } from "../types/can-subject-callback.type.js";
import { Can } from "./can.decorator.js";

class Subject {}

describe("Can", () => {
  it("stores a lazy subject callback on a class without executing it", () => {
    class Controller {}
    const subjectCallback = vi.fn(() => Subject);
    const decorator = Can("read", subjectCallback);
    decorator(Controller);
    expect(decorator.KEY).toBe(CAN_METADATA);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subjectCallback },
    ]);
    expect(subjectCallback).not.toHaveBeenCalled();
  });

  it("infers typed controller and method arguments for async callbacks", () => {
    class Controller {
      findOne(id: string): Promise<Subject> {
        return Promise.resolve({ id });
      }
    }
    const subjectCallback: CanSubjectCallback<Subject, Controller, [string]> = (
      self,
      id,
    ) => self.findOne(id);
    const handler = vi.fn();
    Can("read", subjectCallback)(Controller.prototype, "handle", {
      value: handler,
    });
    expect(Reflect.getMetadata(CAN_METADATA, handler)).toEqual([
      { action: "read", subjectCallback },
    ]);
  });

  it("appends repeated requirements using all semantics", () => {
    class Controller {}
    const subjectCallback = () => Subject;
    Can("read", subjectCallback)(Controller);
    Can("update", subjectCallback)(Controller);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subjectCallback },
      { action: "update", subjectCallback },
    ]);
  });

  it("requires a callback", () => {
    expect(() => {
      // @ts-expect-error Deliberately omit the callback to verify runtime validation.
      return Can("read");
    }).toThrow("Permission subject callback is required.");
    expect(() => {
      // @ts-expect-error Direct record arguments are not callbacks.
      return Can("read", new Subject());
    }).toThrow("Permission subject callback is required.");
  });

  it("rejects direct entity classes in the decorator type", () => {
    // @ts-expect-error Entity classes must be returned by a callback.
    const decorator = Can("read", Subject);
    expect(decorator.KEY).toBe(CAN_METADATA);
  });
});
