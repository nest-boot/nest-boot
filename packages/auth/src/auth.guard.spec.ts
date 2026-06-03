import { RequestContext } from "@nest-boot/request-context";
import { type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";

import { IS_PUBLIC_KEY } from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import { BaseSession } from "./entities";

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
    jest.restoreAllMocks();
  });

  it("allows subclasses to return the full CanActivate result type", () => {
    expect(PromiseAuthGuard).toBeDefined();
    expect(ObservableAuthGuard).toBeDefined();
  });

  it("allows subclasses to reuse the public route metadata lookup", () => {
    const handler = () => undefined;
    class TestController {}

    const context = {
      getClass: jest.fn(() => TestController),
      getHandler: jest.fn(() => handler),
    } as unknown as ExecutionContext;

    const getAllAndOverride = jest.fn(() => true);
    const guard = new PublicAwareAuthGuard({
      getAllAndOverride,
    } as unknown as Reflector);

    expect(guard.isContextPublic(context)).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      TestController,
    ]);
  });

  it("allows public routes without a session", () => {
    const guard = new AuthGuard({
      getAllAndOverride: jest.fn(() => true),
    } as unknown as Reflector);
    const context = {
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it("requires a session for non-public routes", () => {
    const guard = new AuthGuard({
      getAllAndOverride: jest.fn(() => false),
    } as unknown as Reflector);
    const context = {
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;
    const get = jest.spyOn(RequestContext, "get");

    get.mockReturnValueOnce(undefined);
    expect(guard.canActivate(context)).toBe(false);
    expect(get).toHaveBeenCalledWith(BaseSession);

    get.mockReturnValueOnce(new BaseSession());
    expect(guard.canActivate(context)).toBe(true);
  });
});
