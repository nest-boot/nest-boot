import { RequestContext } from "@nest-boot/request-context";

import { AuthAbility } from "../../src/auth.ability.js";
import { Member } from "../../src/entities/member.entity.js";
import { User } from "../../src/entities/user.entity.js";
import { Workspace } from "../../src/entities/workspace.entity.js";
import { MemberApiKeyService } from "../../src/services/member-api-key.service.js";
import { SessionService } from "../../src/services/session.service.js";
import { UserService } from "../../src/services/user.service.js";
import { UserApiKeyService } from "../../src/services/user-api-key.service.js";
import { createWorkspaceServices } from "../workspace-service.fixture.js";
/**
 * Runs a test with the fixture's user and workspace identity.
 * @param callback - Work to execute in the supplied context.
 */
export async function withIdentity(
  callback: (context: ReturnType<typeof fixture>) => void | Promise<void>,
) {
  const data = fixture();
  await RequestContext.run(new RequestContext({ type: "test" }), async () => {
    RequestContext.set(User, data.user);
    RequestContext.set(Workspace, data.workspace);
    RequestContext.set(
      Member,
      Object.assign(new Member(), {
        id: "member",
        user: data.user,
        workspace: data.workspace,
        status: "ACTIVE",
      }),
    );
    const rules = [
      { action: "manage", subject: "all" },
      {
        action: ["read", "write", "update", "revoke"],
        subject: ["User", "Workspace", "Member", "Invitation", "Session"],
        inverted: true,
        conditions: { id: "blocked" },
      },
      {
        action: ["create", "write"],
        subject: ["User", "Workspace", "Member", "UserApiKey", "MemberApiKey"],
        inverted: true,
        conditions: { name: "blocked" },
      },
      {
        action: "write",
        subject: "Invitation",
        inverted: true,
        conditions: { email: "blocked@example.com" },
      },
    ];
    RequestContext.set(AuthAbility, new AuthAbility(rules));
    await callback(data);
  });
}

/**
 * Returns isolated identity, persistence mocks, and services for the test.
 * @returns Isolated identity, persistence mocks, and services for the test.
 */
function fixture() {
  const result = createWorkspaceServices();
  result.authorization.assertCanGrantPermissions.mockRestore();
  result.authorization.authorize.mockRestore();
  result.authorization.can.mockRestore();
  const query = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    toRaw: vi.fn(),
  };
  Object.assign(result.em, { createQueryBuilder: vi.fn(() => query) });
  const user = Object.assign(new User(), {
    id: "actor",
    name: "Actor",
    email: "actor@example.com",
    roles: ["admin"],
  });
  const workspace = Object.assign(new Workspace(), { id: "workspace" });
  return {
    ...result,
    user,
    workspace,
    userService: new UserService(
      result.em,
      { workspace: { enabled: true } },
      { hash: vi.fn().mockResolvedValue("hash") } as never,
      {} as never,
    ),
    sessionService: new SessionService({}, result.em),
    userApiKeyService: new UserApiKeyService(result.em, {
      workspace: { enabled: true },
    }),
    memberApiKeyService: new MemberApiKeyService(result.em, {
      workspace: { enabled: true },
    }),
  };
}
