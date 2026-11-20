import type { CanSubjectCallback } from "../../core/types/can-subject-callback.type.js";
import { CAN_METADATA } from "../constants/permission.constants.js";
import { Can } from "./can.decorator.js";

class Subject {}

describe("Can", () => {
  it("stores a static entity class directly on a class", () => {
    class Controller {}
    const decorator = Can("read", Subject);
    decorator(Controller);
    expect(decorator.KEY).toBe(CAN_METADATA);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
    ]);
  });

  it("stores anonymous classes and string subject names directly", () => {
    class Controller {}
    const AnonymousSubject = class {};
    Can("read", AnonymousSubject)(Controller);
    Can("manage", "Task")(Controller);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: AnonymousSubject },
      { action: "manage", subject: "Task" },
    ]);
  });

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
    Can("read", Subject)(Controller);
    Can("update", subjectCallback)(Controller);
    expect(Reflect.getMetadata(CAN_METADATA, Controller)).toEqual([
      { action: "read", subject: Subject },
      { action: "update", subjectCallback },
    ]);
  });

  it("requires a valid subject type or callback", () => {
    expect(() => {
      // @ts-expect-error Deliberately omit the subject argument to verify runtime validation.
      return Can("read");
    }).toThrow("Permission subject type or callback is required.");
    expect(() => {
      return Can("read", "");
    }).toThrow("Permission subject type or callback is required.");
    expect(() => {
      // @ts-expect-error Direct record instances must be returned by a callback.
      return Can("read", new Subject());
    }).toThrow("Permission subject type or callback is required.");
  });
});
