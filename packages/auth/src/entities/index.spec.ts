import { MetadataStorage } from "@mikro-orm/core";

import { Account } from "./account.entity.js";
import { ApiKeyEntity } from "./api-key.entity.js";
import { entities, workspaceEntities } from "./index.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { SystemAccount } from "./system-account.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("built-in auth entity field ownership", () => {
  it.each([
    [Account, ["issuer", "accountId", "user"]],
    [ApiKeyEntity, ["owner"]],
    [SystemAccount, ["permissions", "createdBy", "enabled"]],
    [Session, ["user", "token", "expiresAt"]],
    [User, ["name", "email"]],
    [Verification, ["identifier", "value"]],
    [Workspace, ["name", "members"]],
    [Invitation, ["email", "workspace", "inviter"]],
    [Member, ["name", "email", "user", "workspace"]],
  ] as const)("%s owns its persistence fields", (entity, fields) => {
    expect([...entities, ...workspaceEntities]).toContain(entity);
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === entity,
    );
    expect(metadata?.abstract).not.toBe(true);
    for (const field of fields) {
      expect(metadata?.properties).toHaveProperty(field);
    }
  });
});
