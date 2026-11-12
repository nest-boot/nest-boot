import { MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";

import { entities, workspaceEntities } from "../dist/index.js";
import {
  Account,
  ApiKey,
  Session,
  User,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from "../dist/index.js";

describe("built-in auth entity discovery", () => {
  it("discovers concrete relations without AuthModule initialization or application entity declarations", async () => {
    const orm = new MikroORM({
      dbName: "auth_entity_relations",
      driver: PgliteDriver,
      entities: [...entities, ...workspaceEntities],
    });
    try {
      for (const [entity, property, target] of [
        [Workspace, "members", WorkspaceMember],
        [WorkspaceMember, "user", User],
        [WorkspaceMember, "workspace", Workspace],
        [WorkspaceInvitation, "inviter", User],
        [WorkspaceInvitation, "workspace", Workspace],
        [Account, "user", User],
        [Session, "user", User],
        [Session, "impersonatedBy", User],
      ] as const) {
        expect(
          orm
            .getMetadata<object>(entity)
            .props.find((entry) => entry.name === property)?.targetMeta?.class,
        ).toBe(target);
      }
      const owner = orm.getMetadata(ApiKey).properties.owner;
      expect(owner.polymorphic).toBe(true);
      expect(owner.polymorphTargets?.map((meta) => meta.class)).toEqual(
        expect.arrayContaining([User, WorkspaceMember]),
      );
      expect(owner.createForeignKeyConstraint).toBe(false);
    } finally {
      await orm.close();
    }
  });
});
