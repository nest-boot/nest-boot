vi.mock("better-auth", () => ({
  betterAuth: vi.fn(),
}));
vi.mock("better-auth/node", () => ({
  toNodeHandler: vi.fn(),
}));
vi.mock("better-auth/plugins", () => ({
  genericOAuth: vi.fn(),
}));
vi.mock("./adapters/mikro-orm-adapter.js", () => ({
  mikroOrmAdapter: vi.fn(),
}));

import { ApiKeyService } from "./api-key.service.js";
import {
  AUTH_TOKEN,
  CURRENT_API_KEY,
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
  IS_PUBLIC_KEY,
} from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { AuthModule } from "./auth.module.js";
import { AuthService } from "./auth.service.js";
import { AuthTransactionContext } from "./auth.transaction-context.js";
import {
  Can,
  CurrentApiKey,
  CurrentWorkspace,
  CurrentWorkspaceMember,
  Public,
} from "./decorators/index.js";
import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "./entities/index.js";
import { PermissionAction } from "./enums/permission-action.enum.js";
import * as publicApi from "./index.js";
import { PermissionAbilityBuilder } from "./permission.ability-builder.js";
import { can } from "./utils/can.util.js";
import { getPermissionAbility } from "./utils/get-permission-ability.util.js";
import { WorkspaceService } from "./workspace.service.js";

describe("public API", () => {
  it("should export auth modules, services, decorators, and entities", () => {
    expect(publicApi.AUTH_TOKEN).toBe(AUTH_TOKEN);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect(publicApi.CURRENT_API_KEY).toBe(CURRENT_API_KEY);
    expect(publicApi.CURRENT_WORKSPACE).toBe(CURRENT_WORKSPACE);
    expect(publicApi.CURRENT_WORKSPACE_MEMBER).toBe(CURRENT_WORKSPACE_MEMBER);
    expect(publicApi.ApiKeyService).toBe(ApiKeyService);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect(publicApi.AuthTransactionContext).toBe(AuthTransactionContext);
    expect(publicApi.Can).toBe(Can);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentWorkspaceMember).toBe(CurrentWorkspaceMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.BaseAccount).toBe(BaseAccount);
    expect(publicApi.BaseSession).toBe(BaseSession);
    expect(publicApi.BaseUser).toBe(BaseUser);
    expect(publicApi.BaseVerification).toBe(BaseVerification);
    expect(publicApi.PermissionAction).toBe(PermissionAction);
    expect(publicApi.PermissionAbilityBuilder).toBe(PermissionAbilityBuilder);
    expect(publicApi.can).toBe(can);
    expect(publicApi.getPermissionAbility).toBe(getPermissionAbility);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
  });
});
