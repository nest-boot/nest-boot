vi.mock("better-auth", () => ({
  betterAuth: vi.fn(),
}));
vi.mock("better-auth/node", () => ({
  toNodeHandler: vi.fn(),
}));
vi.mock("better-auth/plugins", () => ({
  genericOAuth: vi.fn(),
}));
vi.mock("./adapters/mikro-orm-adapter", () => ({
  mikroOrmAdapter: vi.fn(),
}));

import { AUTH_TOKEN, IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { AuthModule } from "./auth.module.js";
import { AuthService } from "./auth.service.js";
import { AuthTransactionContext } from "./auth.transaction-context.js";
import { Public } from "./decorators/index.js";
import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "./entities/index.js";
import * as publicApi from "./index.js";

describe("public API", () => {
  it("should export auth modules, services, decorators, and entities", () => {
    expect(publicApi.AUTH_TOKEN).toBe(AUTH_TOKEN);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect(publicApi.AuthTransactionContext).toBe(AuthTransactionContext);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.BaseAccount).toBe(BaseAccount);
    expect(publicApi.BaseSession).toBe(BaseSession);
    expect(publicApi.BaseUser).toBe(BaseUser);
    expect(publicApi.BaseVerification).toBe(BaseVerification);
  });
});
