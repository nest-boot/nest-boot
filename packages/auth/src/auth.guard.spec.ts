import { type CanActivate, type ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";

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

describe("AuthGuard", () => {
  it("allows subclasses to return the full CanActivate result type", () => {
    expect(PromiseAuthGuard).toBeDefined();
    expect(ObservableAuthGuard).toBeDefined();
  });
});
