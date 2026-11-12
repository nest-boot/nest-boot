import { BaseEntity, ref } from "@mikro-orm/core";

import { AuthAbility } from "../../common/auth.ability.js";
import { User } from "../../core/entities/user.entity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { toApiKeyView } from "./api-key-view.util.js";

describe("API-key public views", () => {
  it.each([
    { owner: () => ref(User, new User()), view: UserApiKey },
    { owner: () => ref(Member, new Member()), view: WorkspaceApiKey },
    {
      owner: () => ref(SystemAccount, new SystemAccount()),
      view: SystemApiKey,
    },
  ])(
    "preserves authorization conditions and managed state for $view.name snapshots",
    ({ owner, view }) => {
      const key = Object.assign(new ApiKey(), {
        owner: owner(),
        key: "stored-credential-hash",
        internalState: "private",
      });
      const ability = new AuthAbility([
        { action: "read", subject: view, conditions: { id: key.id } },
      ]);
      const snapshot = toApiKeyView(key);

      expect(snapshot).toBeInstanceOf(view);
      expect(snapshot).not.toHaveProperty("key");
      expect(snapshot).not.toHaveProperty("internalState");
      expect(snapshot).not.toBeInstanceOf(BaseEntity);
      snapshot.permissions.push("snapshot-only");
      expect(key.permissions).not.toContain("snapshot-only");
      expect(snapshot.owner).toBe(key.owner);
      expect(key.constructor).toBe(ApiKey);
      expect(key.key).toBe("stored-credential-hash");
      expect(ability.can("read", key)).toBe(true);
      expect(ability.can("read", snapshot)).toBe(true);
      expect(
        ability.can(
          "read",
          Object.assign(toApiKeyView(key), {
            id: "another-key",
          }),
        ),
      ).toBe(false);
    },
  );
});
