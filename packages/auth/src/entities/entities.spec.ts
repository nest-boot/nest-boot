import { BaseAccount } from "./account.entity.js";
import { BaseApiKey } from "./api-key.entity.js";
import { BaseSession } from "./session.entity.js";
import { BaseUser } from "./user.entity.js";
import { BaseVerification } from "./verification.entity.js";
import { BaseWorkspace } from "./workspace.entity.js";
import { BaseWorkspaceInvitation } from "./workspace-invitation.entity.js";
import { BaseWorkspaceMember } from "./workspace-member.entity.js";

class TestAccount extends BaseAccount {}
class TestVerification extends BaseVerification {}

describe("auth entities", () => {
  it("should initialize generated ids and timestamps", () => {
    const account = new TestAccount();
    const apiKey = new BaseApiKey();
    const session = new BaseSession();
    const user = new BaseUser();
    const verification = new TestVerification();
    const workspace = new BaseWorkspace();
    const workspaceInvitation = new BaseWorkspaceInvitation();
    const workspaceMember = new BaseWorkspaceMember();

    for (const entity of [
      account,
      apiKey,
      session,
      user,
      verification,
      workspace,
      workspaceInvitation,
      workspaceMember,
    ]) {
      expect(entity.id).toEqual(expect.any(String));
      expect(entity.createdAt).toBeInstanceOf(Date);
      if ("updatedAt" in entity) {
        expect(entity.updatedAt).toBeInstanceOf(Date);
      }
    }
    expect(apiKey.enabled).toBe(true);
    expect(apiKey.permissions).toEqual([]);
    expect(user.permissions).toEqual([]);
    expect(user.roles).toEqual(["user"]);
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
    expect(user.banExpiresAt).toBeNull();
    expect(workspace.deletedAt).toBeNull();
    expect(workspaceInvitation.status).toBe("pending");
    expect(workspaceMember.permissions).toEqual([]);
    expect(workspaceMember.roles).toEqual(["member"]);
    expect(workspaceMember.status).toBe("ACTIVE");
  });

  it("should load entities in an isolated module", async () => {
    vi.resetModules();

    expect((await import("./account.entity.js")).BaseAccount).toBeDefined();
    expect((await import("./api-key.entity.js")).BaseApiKey).toBeDefined();
    expect((await import("./session.entity.js")).BaseSession).toBeDefined();
    expect((await import("./user.entity.js")).BaseUser).toBeDefined();
    expect(
      (await import("./verification.entity.js")).BaseVerification,
    ).toBeDefined();
    expect(
      (await import("./workspace-member.entity.js")).BaseWorkspaceMember,
    ).toBeDefined();
    expect(
      (await import("./workspace-invitation.entity.js"))
        .BaseWorkspaceInvitation,
    ).toBeDefined();
    expect((await import("./workspace.entity.js")).BaseWorkspace).toBeDefined();
  });

  it("should pass relation and update callbacks to MikroORM decorators", async () => {
    const relationTargets: unknown[] = [];
    const updateValues: unknown[] = [];
    const decorator = () => () => undefined;

    vi.resetModules();
    vi.doMock("@mikro-orm/decorators/legacy", async () => {
      const actual = await vi.importActual<
        typeof import("@mikro-orm/decorators/legacy")
      >("@mikro-orm/decorators/legacy");

      return {
        ...actual,
        Entity: decorator,
        Index: decorator,
        ManyToOne: (options: { entity?: () => unknown }) => {
          relationTargets.push(options.entity?.());
          return () => undefined;
        },
        PrimaryKey: decorator,
        Property: (options: { onUpdate?: () => unknown } = {}) => {
          if (options.onUpdate) {
            updateValues.push(options.onUpdate());
          }
          return () => undefined;
        },
        Unique: decorator,
      };
    });

    await import("./account.entity.js");
    await import("./api-key.entity.js");
    await import("./session.entity.js");
    await import("./user.entity.js");
    await import("./verification.entity.js");
    await import("./workspace-member.entity.js");
    await import("./workspace-invitation.entity.js");
    await import("./workspace.entity.js");
    vi.doUnmock("@mikro-orm/decorators/legacy");

    expect(relationTargets).toEqual([
      "User",
      ["User", "Workspace"],
      "User",
      "User",
      "User",
      "Workspace",
      "User",
      "Workspace",
    ]);
    expect(updateValues).toHaveLength(7);
    expect(updateValues.every((value) => value instanceof Date)).toBe(true);
  });
});
