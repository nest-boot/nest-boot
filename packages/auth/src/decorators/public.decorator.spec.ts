import { IS_PUBLIC_KEY } from "../auth.constants.js";
import { Public } from "./public.decorator.js";

describe("auth.decorators.spec.ts", () => {
  describe("auth decorators", () => {
    it("should create metadata decorators for public routes", () => {
      const descriptor = {
        value: () => undefined,
      };
      class TestController {}
      Public(false)(
        TestController.prototype,
        "handler",
        descriptor as PropertyDescriptor,
      );
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value)).toBe(false);
    });
  });
});
