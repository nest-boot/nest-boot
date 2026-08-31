import { IS_PUBLIC_KEY } from "../auth.constants.js";
import { BaseSession, BaseUser } from "../entities/index.js";
import * as decorators from "./index.js";
import { Public } from "./public.decorator.js";

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

  it("should resolve current user and session from request context", async () => {
    const user = new BaseUser();
    const session = new BaseSession();
    const get = vi.fn((token: { name?: string }) => {
      if (token.name === "BaseUser") return user;
      if (token.name === "BaseSession") return session;
      return undefined;
    });

    vi.resetModules();
    vi.doMock("@nest-boot/request-context", () => ({
      RequestContext: {
        get,
      },
    }));
    vi.doMock("@nestjs/common", async () => {
      const actual =
        await vi.importActual<typeof import("@nestjs/common")>(
          "@nestjs/common",
        );

      return {
        ...actual,
        createParamDecorator: (factory: () => unknown) => factory,
      };
    });

    const { CurrentUser } = await import("./current-user.decorator.js");
    const { CurrentSession } = await import("./current-session.decorator.js");

    expect(CurrentUser()).toBe(user);
    expect(CurrentSession()).toBe(session);
    vi.doUnmock("@nest-boot/request-context");
    vi.doUnmock("@nestjs/common");
  });
});
