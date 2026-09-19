import { IS_PUBLIC_KEY } from "../auth.constants.js";
import { Session as BaseSession } from "../entities/session.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import * as decorators from "./index.js";
import { Public } from "./public.decorator.js";

describe("auth decorators", () => {
  it("should export public decorator helpers", () => {
    expect(decorators.Public).toBe(Public);
    expect(decorators.CurrentSession).toBeDefined();
    expect(decorators.CurrentUser).toBeDefined();
    expect(decorators.CurrentApiKey).toBeDefined();
    expect(decorators.CurrentWorkspace).toBeDefined();
    expect(decorators.CurrentMember).toBeDefined();
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
      if (token.name === "User") return user;
      if (token.name === "Session") return session;
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

  it("should resolve workspace authentication values from request context", async () => {
    const apiKey = { id: "api-key-1" };
    const workspace = { id: "workspace-1" };
    const member = { id: "member-1" };
    const get = vi.fn((token: { name?: string } | symbol) => {
      switch (typeof token === "symbol" ? token.description : token.name) {
        case "API_KEY":
          return apiKey;
        case "Workspace":
          return workspace;
        case "Member":
          return member;
        default:
          return undefined;
      }
    });

    vi.resetModules();
    vi.doMock("@nest-boot/request-context", () => ({
      RequestContext: { get, isActive: () => true },
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

    const { CurrentApiKey } = await import("./current-api-key.decorator.js");
    const { CurrentWorkspace } =
      await import("./current-workspace.decorator.js");
    const { CurrentMember } = await import("./current-member.decorator.js");

    expect(CurrentApiKey()).toBe(apiKey);
    expect(CurrentWorkspace()).toBe(workspace);
    expect(CurrentMember()).toBe(member);
    expect(
      get.mock.calls.map(([token]) =>
        typeof token === "symbol" ? token.description : token.name,
      ),
    ).toEqual(["API_KEY", "Workspace", "Member"]);
    vi.doUnmock("@nest-boot/request-context");
    vi.doUnmock("@nestjs/common");
  });
});
