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
  UserCan,
  WorkspaceCan,
} from "./decorators/index.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import * as publicApi from "./index.js";
import { PermissionAbilityBuilder } from "./permission.ability-builder.js";
import { SessionService } from "./session.service.js";
import { UserService } from "./user.service.js";
import { can } from "./utils/can.util.js";
import { getUserAbility } from "./utils/get-user-ability.util.js";
import { getWorkspaceAbility } from "./utils/get-workspace-ability.util.js";
import { userCan } from "./utils/user-can.util.js";
import { workspaceCan } from "./utils/workspace-can.util.js";
import { WorkspaceService } from "./workspace.service.js";

describe("public API", () => {
  it("should export auth modules, services, decorators, and entities", () => {
    expect("AUTH_TOKEN" in publicApi).toBe(false);
    expect(publicApi.UserService).toBe(UserService);
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
    expect(publicApi.UserCan).toBe(UserCan);
    expect(publicApi.WorkspaceCan).toBe(WorkspaceCan);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentWorkspaceMember).toBe(CurrentWorkspaceMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.BaseAccount).toBe(BaseAccount);
    expect(publicApi.BaseApiKey).toBe(BaseApiKey);
    expect(publicApi.BaseSession).toBe(BaseSession);
    expect(publicApi.BaseUser).toBe(BaseUser);
    expect(publicApi.BaseVerification).toBe(BaseVerification);
    expect(publicApi.BaseWorkspace).toBe(BaseWorkspace);
    expect(publicApi.BaseWorkspaceInvitation).toBe(BaseWorkspaceInvitation);
    expect(publicApi.BaseWorkspaceMember).toBe(BaseWorkspaceMember);
    expect(publicApi.PermissionAbilityBuilder).toBe(PermissionAbilityBuilder);
    expect(publicApi.can).toBe(can);
    expect(publicApi.getUserAbility).toBe(getUserAbility);
    expect(publicApi.getWorkspaceAbility).toBe(getWorkspaceAbility);
    expect(publicApi.userCan).toBe(userCan);
    expect(publicApi.workspaceCan).toBe(workspaceCan);
    expect(publicApi.SessionService).toBe(SessionService);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
  });
});
