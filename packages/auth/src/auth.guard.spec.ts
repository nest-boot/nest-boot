import { RequestContext } from "@nest-boot/request-context";
import {
  type CanActivate,
  type ExecutionContext,
  type Type,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import type { Mock } from "vitest";

import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { BaseSession } from "./entities/index.js";

class PromiseAuthGuard extends AuthGuard {
  override canActivate(
    _context: ExecutionContext,
  ): ReturnType<CanActivate["canActivate"]> {
    return Promise.resolve(true);
  }
}

class ObservableAuthGuard extends AuthGuard {
  override canActivate(
    _context: ExecutionContext,
  ): ReturnType<CanActivate["canActivate"]> {
    return of(true);
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

  it("allows subclasses to return the full CanActivate result type", () => {
    expect(PromiseAuthGuard).toBeDefined();
    expect(ObservableAuthGuard).toBeDefined();
  });

  it("allows subclasses to reuse the public route metadata lookup", async () => {
    const handler = () => undefined;
    class TestController {}

    const context = {
      getClass: vi.fn(() => TestController),
      getHandler: vi.fn(() => handler),
    } as unknown as ExecutionContext;

    const getAllAndOverride = vi.fn(() => true);
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
      vi.fn(() => true),
    );
    const context = {
      getClass: vi.fn(),
      getHandler: vi.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it("requires a session for non-public routes", async () => {
    const { guard } = await createGuard(
      AuthGuard,
      vi.fn(() => false),
    );
    const context = {
      getClass: vi.fn(),
      getHandler: vi.fn(),
    } as unknown as ExecutionContext;
    const get = vi.spyOn(RequestContext, "get");

    get.mockReturnValueOnce(undefined);
    expect(guard.canActivate(context)).toBe(false);
    expect(get).toHaveBeenCalledWith(BaseSession);

    get.mockReturnValueOnce(new BaseSession());
    expect(guard.canActivate(context)).toBe(true);
  });
});

async function createGuard<T extends AuthGuard>(
  guardType: Type<T>,
  getAllAndOverride: Mock,
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      guardType,
      {
        provide: Reflector,
        useValue: {
          getAllAndOverride,
        },
      },
    ],
  }).compile();

  return {
    guard: moduleRef.get(guardType),
  };
}
