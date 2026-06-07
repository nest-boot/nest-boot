jest.mock("better-auth", () => ({
  betterAuth: jest.fn(),
}));
jest.mock("better-auth/node", () => ({
  toNodeHandler: jest.fn(),
}));
jest.mock("better-auth/plugins", () => ({
  genericOAuth: jest.fn(),
}));
jest.mock("./adapters/mikro-orm-adapter", () => ({
  mikroOrmAdapter: jest.fn(),
}));

import * as publicApi from ".";
import { AUTH_TOKEN, IS_PUBLIC_KEY } from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import { AuthMiddleware } from "./auth.middleware";
import { AuthModule } from "./auth.module";
import { AuthService } from "./auth.service";
import { AuthTransactionContext } from "./auth.transaction-context";
import { Public } from "./decorators";
import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "./entities";

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
