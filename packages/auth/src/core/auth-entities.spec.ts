import { MetadataStorage } from "@mikro-orm/core";

import { ApiKey } from "../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { entities } from "./auth-entities.js";
import { workspaceEntities } from "./auth-entities.js";
import { Account } from "./entities/account.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";

describe("built-in auth entity field ownership", () => {
  it.each([
    [Account, ["issuer", "accountId", "user"]],
    [ApiKey, ["owner"]],
    [SystemAccount, ["permissions", "createdBy", "enabled"]],
    [Session, ["user", "token", "expiresAt"]],
    [User, ["name", "email"]],
    [Verification, ["identifier", "value"]],
    [Workspace, ["name", "members"]],
    [WorkspaceInvitation, ["email", "workspace", "inviter"]],
    [WorkspaceMember, ["name", "email", "user", "workspace"]],
  ] as const)("%s owns its persistence fields", (entity, fields) => {
    const registered = [...entities, ...workspaceEntities].find(
      (entry) => (typeof entry === "function" ? entry : entry.class) === entity,
    );
    expect(registered).toBeDefined();
    const metadata =
      registered && typeof registered !== "function"
        ? registered.init().meta
        : Object.values(MetadataStorage.getMetadata()).find(
            (meta) => meta.class === entity,
          );
    expect(metadata?.abstract).not.toBe(true);
    for (const field of fields) {
      expect(metadata?.properties).toHaveProperty(field);
    }
  });
});
