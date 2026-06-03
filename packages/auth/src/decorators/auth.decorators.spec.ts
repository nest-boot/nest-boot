import { IS_PUBLIC_KEY } from "../auth.constants";
import { BaseSession, BaseUser } from "../entities";
import * as decorators from "./index";
import { Public } from "./public.decorator";

describe("auth decorators", () => {
  it("should export public decorator helpers", () => {
    expect(decorators.Public).toBe(Public);
    expect(decorators.CurrentSession).toBeDefined();
    expect(decorators.CurrentUser).toBeDefined();
  });

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

  it("should resolve current user and session from request context", () => {
    const user = new BaseUser();
    const session = new BaseSession();
    const get = jest.fn((token: { name?: string }) => {
      if (token.name === "BaseUser") return user;
      if (token.name === "BaseSession") return session;
      return undefined;
    });

    jest.isolateModules(() => {
      jest.doMock("@nest-boot/request-context", () => ({
        RequestContext: {
          get,
        },
      }));
      jest.doMock("@nestjs/common", () => {
        const actual = jest.requireActual("@nestjs/common");

        return {
          ...actual,
          createParamDecorator: (factory: () => unknown) => factory,
        };
      });

      const { CurrentUser } = jest.requireActual<
        typeof import("./current-user.decorator")
      >("./current-user.decorator");
      const { CurrentSession } = jest.requireActual<
        typeof import("./current-session.decorator")
      >("./current-session.decorator");

      expect(CurrentUser()).toBe(user);
      expect(CurrentSession()).toBe(session);
      jest.dontMock("@nest-boot/request-context");
      jest.dontMock("@nestjs/common");
    });
  });
});
