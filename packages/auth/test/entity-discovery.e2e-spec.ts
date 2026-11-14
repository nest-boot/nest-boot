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

  it("hydrates API-key IDs as strings without the application metadata provider", async () => {
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      dbName: "memory://",
      entities: [...entities, ...workspaceEntities],
    });
    try {
      for (const role of ["anonymous", "authenticated"]) {
        await orm.em.execute(`create role ${role} nologin`);
      }
      await orm.schema.create();
      const em = orm.em.fork();
      expect(
        await em.execute(
          "select data_type from information_schema.columns where table_schema = 'public' and table_name = 'api_key' and column_name = 'id'",
        ),
      ).toEqual([{ data_type: "bigint" }]);
      const user = em.create(User, {
        name: "Owner",
        email: "owner@example.test",
        emailVerified: true,
      });
      const key = em.create(ApiKey, {
        name: "Native hydration",
        owner: user,
        key: "synthetic-test-hash",
      });
      await em.persist([user, key]).flush();
      em.clear();
      const reloaded = await em.findOneOrFail(ApiKey, {
        name: "Native hydration",
      });
      expect(typeof reloaded.id).toBe("string");
      expect(reloaded.id).toBe(key.id);
    } finally {
      await orm.close();
    }
  });
});
