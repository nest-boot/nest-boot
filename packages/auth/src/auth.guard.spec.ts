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

import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseSession, BaseUser } from "./entities/index.js";
import { USER_CAN_METADATA } from "./permission.constants.js";

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
    const can = vi.fn(() => true);
    const buildAbility = vi.fn(() => ({ can }));
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
      { user: { buildAbility: buildAbility as never } },
    );

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(BaseUser, new BaseUser());
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildAbility).toHaveBeenCalledOnce();
    expect(can).toHaveBeenCalledWith("read", Subject);
  });

  it("requires class-level and handler-level permissions together", async () => {
    class Subject {}
    const can = vi.fn((action: string) => action === "read");
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
      { user: { buildAbility: vi.fn(() => ({ can })) as never } },
      getAllAndMerge,
    );
    const context = createContext();

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(BaseSession, new BaseSession());
      RequestContext.set(BaseUser, new BaseUser());

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });

    expect(getAllAndMerge).toHaveBeenCalledWith(USER_CAN_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    expect(can).toHaveBeenNthCalledWith(1, "read", Subject);
    expect(can).toHaveBeenNthCalledWith(2, "update", Subject);
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
  };
}

function createContext() {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
  } as unknown as ExecutionContext;
}
