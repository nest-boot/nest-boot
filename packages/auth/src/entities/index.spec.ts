import { MetadataStorage } from "@mikro-orm/core";

import { Account } from "./account.entity.js";
import { entities } from "./index.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { MemberApiKey } from "./member-api-key.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { UserApiKey } from "./user-api-key.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("built-in auth entity field ownership", () => {
  it.each([
    [Account, ["issuer", "accountId", "user"]],
    [UserApiKey, ["user", "permissions"]],
    [MemberApiKey, ["member", "permissions"]],
    [Session, ["user", "token", "expiresAt"]],
    [User, ["name", "email", "members"]],
    [Verification, ["identifier", "value"]],
    [Workspace, ["name", "members"]],
    [Invitation, ["email", "workspace", "inviter"]],
    [Member, ["name", "email", "user", "workspace"]],
  ] as const)("%s owns its persistence fields", (entity, fields) => {
    expect(entities).toContain(entity);
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === entity,
    );
    expect(metadata?.abstract).not.toBe(true);
    for (const field of fields) {
      expect(metadata?.properties).toHaveProperty(field);
    }
  });
});
