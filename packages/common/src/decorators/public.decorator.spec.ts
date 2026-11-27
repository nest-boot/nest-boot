import "reflect-metadata";

import { IS_PUBLIC_KEY } from "../constants/public.constants.js";
import { Public } from "./public.decorator.js";

describe("Public", () => {
  it("sets IS_PUBLIC_KEY metadata on classes and methods", () => {
    @Public()
    class PublicController {}

    const descriptor: PropertyDescriptor = {
      value: () => undefined,
    };
    class RestrictedController {}
    Public(false)(RestrictedController.prototype, "handler", descriptor);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicController)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value as object)).toBe(
      false,
    );
  });
});
