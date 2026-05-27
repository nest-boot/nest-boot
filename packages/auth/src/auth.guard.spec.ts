import { type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";

import { IS_PUBLIC_KEY } from "./auth.constants";
import { AuthGuard } from "./auth.guard";

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
});
