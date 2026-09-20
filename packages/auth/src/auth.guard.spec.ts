import { RequestContext } from "@nest-boot/request-context";
import {
  type ExecutionContext,
  type Type,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { firstValueFrom, of } from "rxjs";
import type { Mock } from "vitest";

import { AuthAbility } from "./abilities/auth.ability.js";
import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { Member } from "./entities/member.entity.js";
import { Session as BaseSession } from "./entities/session.entity.js";
import { User as BaseUser } from "./entities/user.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import { CAN_METADATA } from "./permission.constants.js";
import * as abilityChecks from "./utils/can.util.js";
class PromiseAuthGuard extends AuthGuard {
  override canActivate(_context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class ObservableDelegateAuthGuard extends AuthGuard {
  override canActivate(_context: ExecutionContext): Promise<boolean> {
    return firstValueFrom(of(true));
  }
}

class PublicAwareAuthGuard extends AuthGuard {
  isContextPublic(context: ExecutionContext): boolean {
    return this.isPublic(context);
  }
}

describe("AuthGuard", () => {
  it("does not resolve protected subjects when the required identity is missing", async () => {
    const subjectFactory = vi.fn(() => new BaseUser());
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn(() => true),
      {},
      vi.fn((key) =>
        key === CAN_METADATA
          ? [{ action: "read", subject: subjectFactory }]
          : [],
      ),
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
      expect(subjectFactory).not.toHaveBeenCalled();
    });
  });
  it("uses the shared ability check for decorator decisions", async () => {
    const { guard, access } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
      {},
      vi.fn((key) =>
        key === CAN_METADATA ? [{ action: "read", subject: BaseUser }] : [],
      ),
    );
    const check = vi.spyOn(access, "can").mockReturnValue(false);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        BaseUser,
        Object.assign(new BaseUser(), { roles: ["admin"] }),
      );
      RequestContext.set(BaseSession, new BaseSession());
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
      expect(RequestContext.get(AuthAbility)?.can("read", BaseUser)).toBe(true);
      expect(check).toHaveBeenCalledWith("read", BaseUser);
    });
  });

  it("replaces cached grants after an identity switch and clears departed workspace grants", async () => {
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
      {
        buildAbility: ({ cannot }, { user, workspace }) => {
          if (user) cannot("read", BaseUser, { id: { $ne: user.id } });
          if (workspace)
            cannot("update", Workspace, { id: { $ne: workspace.id } });
        },
      },
    );
    const original = Object.assign(new BaseUser(), {
      id: "original",
      permissions: ["user:read"],
    });
    const replacement = Object.assign(new BaseUser(), {
      id: "replacement",
      permissions: ["user:read"],
    });
    const workspace = Object.assign(new Workspace(), { id: "workspace" });
    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(BaseSession, new BaseSession());
      RequestContext.set(BaseUser, original);
      RequestContext.set(Workspace, workspace);
      RequestContext.set(
        Member,
        Object.assign(new Member(), {
          workspace,
          user: original,
          permissions: ["workspace:update"],
        }),
      );
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
      const originalAbility = RequestContext.get(AuthAbility);
      expect(originalAbility?.can("read", original)).toBe(true);
      expect(RequestContext.get(AuthAbility)?.can("update", workspace)).toBe(
        true,
      );

      RequestContext.set(BaseUser, replacement);
      RequestContext.set<Member | null>(Member, null);
      RequestContext.set<Workspace | null>(Workspace, null);
      guard.refreshAbility();
      const refreshed = RequestContext.get(AuthAbility);
      expect(refreshed).not.toBe(originalAbility);
      expect(refreshed?.can("read", replacement)).toBe(true);
      expect(refreshed?.can("read", original)).toBe(false);
      expect(RequestContext.get(AuthAbility)?.can("update", Workspace)).toBe(
        false,
      );
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
      expect(RequestContext.get(AuthAbility)?.can("update", Workspace)).toBe(
        false,
      );

      RequestContext.set<BaseUser | null>(BaseUser, null);
      guard.refreshAbility();
      expect(RequestContext.get(AuthAbility)?.can("update", Workspace)).toBe(
        false,
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows promise-returning subclasses and adapted observable results", async () => {
    const promise = await createGuard(PromiseAuthGuard, vi.fn());
    const observable = await createGuard(ObservableDelegateAuthGuard, vi.fn());
    await expect(promise.guard.canActivate(createContext())).resolves.toBe(
      true,
    );
    await expect(observable.guard.canActivate(createContext())).resolves.toBe(
      true,
    );
  });

  it("allows subclasses to reuse the public route metadata lookup", async () => {
    const handler = () => undefined;
    class TestController {}

    const context = {
      getClass: vi.fn(() => TestController),
      getHandler: vi.fn(() => handler),
    } as unknown as ExecutionContext;

    const getAllAndOverride = vi.fn((key) => key === IS_PUBLIC_KEY);
    const { guard } = await createGuard(
      PublicAwareAuthGuard,
      getAllAndOverride,
    );

    expect(guard.isContextPublic(context)).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      TestController,
    ]);
  });

  it("allows public routes without a session", async () => {
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn((key) => key === IS_PUBLIC_KEY),
    );
    const context = {
      getClass: vi.fn(),
      getHandler: vi.fn(),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("throws an unauthorized exception for unauthenticated protected routes", async () => {
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
    );
    const context = {
      getClass: vi.fn(),
      getHandler: vi.fn(),
    } as unknown as ExecutionContext;
    const get = vi.spyOn(RequestContext, "get");

    get.mockReturnValue(undefined);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(get).toHaveBeenCalledWith(BaseSession);

    get.mockReturnValue(new BaseSession());
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("does not build an ability for unauthenticated protected routes", async () => {
    class Subject {}
    const buildAbility = vi.fn();
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn((key) =>
        key === CAN_METADATA
          ? [
              {
                action: "read",
                subject: Subject,
              },
            ]
          : false,
      ),
      { buildAbility },
    );

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    expect(buildAbility).not.toHaveBeenCalled();
  });

  it("checks Can metadata on public routes without requiring a session", async () => {
    class Subject {}
    const buildAbility = vi.fn((rules) => {
      rules.can({ user: "subject:read" }, "read", Subject);
    });
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn((key) => {
        if (key === IS_PUBLIC_KEY) {
          return true;
        }

        if (key === CAN_METADATA) {
          return [
            {
              action: "read",
              subject: Subject,
            },
          ];
        }

        return undefined;
      }),
      { buildAbility, user: { permissions: ["subject:read"] } },
    );

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(
        BaseUser,
        Object.assign(new BaseUser(), { permissions: ["subject:read"] }),
      );
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildAbility).toHaveBeenCalledOnce();
  });

  it("requires class-level and handler-level permissions together", async () => {
    class Subject {}
    const getAllAndOverride = vi.fn((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      return key === CAN_METADATA
        ? [{ action: "read", subject: Subject }]
        : undefined;
    });
    const getAllAndMerge = vi.fn((key) =>
      key === CAN_METADATA
        ? [
            { action: "read", subject: Subject },
            { action: "update", subject: Subject },
          ]
        : undefined,
    );
    const { guard } = await createGuard(
      AuthGuard,
      getAllAndOverride,
      {
        buildAbility: (rules) => {
          rules.can({ user: "subject:read" }, "read", Subject);
        },

        user: {
          permissions: ["subject:read"],
        },
      },
      getAllAndMerge,
    );
    const context = createContext();

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(BaseSession, new BaseSession());
      RequestContext.set(
        BaseUser,
        Object.assign(new BaseUser(), { permissions: ["subject:read"] }),
      );

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });

    expect(getAllAndMerge).toHaveBeenCalledWith(CAN_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});

async function createGuard<T extends AuthGuard>(
  guardType: Type<T>,
  getAllAndOverride: Mock,
  options: Partial<AuthModuleOptions> = {},
  getAllAndMerge: Mock = getAllAndOverride,
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      guardType,
      {
        provide: Reflector,
        useValue: {
          getAllAndMerge,
          getAllAndOverride,
        },
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: options,
      },
    ],
  }).compile();

  return {
    guard: moduleRef.get(guardType),
    access: abilityChecks,
  };
}

function createContext() {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
  } as unknown as ExecutionContext;
}
