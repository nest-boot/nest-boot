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

import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { Member } from "./entities/member.entity.js";
import { Session as BaseSession } from "./entities/session.entity.js";
import { User as BaseUser } from "./entities/user.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import { USER_CAN_METADATA } from "./permission.constants.js";
import { AccessControlService } from "./services/access-control.service.js";

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
        key === USER_CAN_METADATA
          ? [{ action: "read", subject: subjectFactory }]
          : [],
      ),
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
      expect(subjectFactory).not.toHaveBeenCalled();
    });
  });

  it("delegates decorator decisions to AccessControlService without a direct-ability fallback", async () => {
    const { guard, access } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
      {},
      vi.fn((key) =>
        key === USER_CAN_METADATA ? [{ action: "get", subject: BaseUser }] : [],
      ),
    );
    const check = vi.spyOn(access, "userCan").mockReturnValue(false);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        BaseUser,
        Object.assign(new BaseUser(), { roles: ["admin"] }),
      );
      RequestContext.set(BaseSession, new BaseSession());
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
      expect(RequestContext.get(UserAbility)?.can("get", BaseUser)).toBe(true);
      expect(check).toHaveBeenCalledWith("get", BaseUser);
    });
  });

  it("replaces cached grants after an identity switch and clears departed workspace grants", async () => {
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
      {
        user: {
          buildAbility: (builder, _permissions, user) => {
            builder.cannot("read", BaseUser, { id: { $ne: user.id } });
          },
        },
        workspace: {
          buildAbility: (builder, _permissions, workspace) => {
            builder.cannot("update", Workspace, { id: { $ne: workspace.id } });
          },
        },
      },
    );
    const original = Object.assign(new BaseUser(), {
      id: "original",
      permissions: ["user:get"],
    });
    const replacement = Object.assign(new BaseUser(), {
      id: "replacement",
      permissions: ["user:get"],
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
          permissions: ["workspace:update"],
        }),
      );
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
      const originalAbility = RequestContext.get(UserAbility);
      expect(originalAbility?.can("read", original)).toBe(true);
      expect(
        RequestContext.get(WorkspaceAbility)?.can("update", workspace),
      ).toBe(true);

      RequestContext.set(BaseUser, replacement);
      RequestContext.set<Member | null>(Member, null);
      RequestContext.set<Workspace | null>(Workspace, null);
      guard.refreshAbilities();
      const refreshed = RequestContext.get(UserAbility);
      expect(refreshed).not.toBe(originalAbility);
      expect(refreshed?.can("read", replacement)).toBe(true);
      expect(refreshed?.can("read", original)).toBe(false);
      expect(RequestContext.get(WorkspaceAbility)).toBeNull();
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
      expect(RequestContext.get(WorkspaceAbility)).toBeNull();

      RequestContext.set<BaseUser | null>(BaseUser, null);
      guard.refreshAbilities();
      expect(RequestContext.get(UserAbility)).toBeNull();
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
        key === USER_CAN_METADATA
          ? [
              {
                action: "read",
                subject: Subject,
              },
            ]
          : false,
      ),
      { user: { buildAbility } },
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
      rules.can("subject:read", "read", Subject);
    });
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn((key) => {
        if (key === IS_PUBLIC_KEY) {
          return true;
        }

        if (key === USER_CAN_METADATA) {
          return [
            {
              action: "read",
              subject: Subject,
            },
          ];
        }

        return undefined;
      }),
      { user: { permissions: ["subject:read"], buildAbility } },
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
      return key === USER_CAN_METADATA
        ? [{ action: "read", subject: Subject }]
        : undefined;
    });
    const getAllAndMerge = vi.fn((key) =>
      key === USER_CAN_METADATA
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
        user: {
          permissions: ["subject:read"],
          buildAbility: (rules) => {
            rules.can("subject:read", "read", Subject);
          },
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

    expect(getAllAndMerge).toHaveBeenCalledWith(USER_CAN_METADATA, [
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
      AccessControlService,
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
    access: moduleRef.get(AccessControlService),
  };
}

function createContext() {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
  } as unknown as ExecutionContext;
}
