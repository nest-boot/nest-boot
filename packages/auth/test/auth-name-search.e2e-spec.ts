import assert from "node:assert/strict";

import { wrap } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import {
  type ConnectionClass,
  ConnectionManager,
} from "@nest-boot/graphql-connection";

import { SystemAccountConnection } from "../src/admin/connections/system-account.connection-definition.js";
import { SystemApiKeyConnection } from "../src/api-key/connections/system-api-key.connection-definition.js";
import { UserApiKeyConnection } from "../src/api-key/connections/user-api-key.connection-definition.js";
import { WorkspaceApiKeyConnection } from "../src/api-key/connections/workspace-api-key.connection-definition.js";
import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../src/api-key/entities/system-account.entity.js";
import { UserConnection } from "../src/core/connections/user.connection-definition.js";
import { User } from "../src/core/entities/user.entity.js";
import { entities, workspaceEntities } from "../src/index.js";
import { WorkspaceConnection } from "../src/workspace/connections/workspace.connection-definition.js";
import { WorkspaceMemberConnection } from "../src/workspace/connections/workspace-member.connection-definition.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";

interface NamedRecord {
  id: string;
  name: string;
  searchableName?: string | null;
}

const cases = [
  ["user", User, UserConnection],
  ["workspace", Workspace, WorkspaceConnection],
  ["member", WorkspaceMember, WorkspaceMemberConnection],
  ["system account", SystemAccount, SystemAccountConnection],
  ["user key", ApiKey, UserApiKeyConnection],
  ["workspace key", ApiKey, WorkspaceApiKeyConnection],
  ["system key", ApiKey, SystemApiKeyConnection],
] as const;

describe("Auth name search through real connection queries", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      dbName: "memory://",
      metadataProvider,
      metadataCache: { enabled: false },
      entities: [...entities, ...workspaceEntities],
    });
    for (const role of ["anonymous", "authenticated"]) {
      await orm.em.execute(`create role ${role} nologin noinherit`);
    }
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm?.close();
  });

  it.each(cases)(
    "searches and refreshes the %s name while preserving native filters",
    async (label, entity, connection) => {
      const em = orm.em.fork();
      const name = "你好世界 Deployment";
      const user = em.create(User, {
        name,
        email: `${crypto.randomUUID()}@example.test`,
        emailVerified: true,
      });
      const workspace = em.create(Workspace, { name });
      const member = em.create(WorkspaceMember, {
        name,
        workspace,
        user,
        email: `contact-${crypto.randomUUID()}@example.test`,
      });
      const account = em.create(SystemAccount, { name });
      const key = em.create(ApiKey, {
        name,
        key: crypto.randomUUID(),
        owner:
          label === "workspace key"
            ? member
            : label === "system key"
              ? account
              : user,
      });
      await em.persist([user, workspace, member, account, key]).flush();
      const record = [user, workspace, member, account, key].find(
        (row) => row instanceof entity,
      );
      assert(record);
      const manager = new ConnectionManager(em);
      const find = (query: string, id = record.id) =>
        manager.find(
          connection as ConnectionClass<NamedRecord>,
          { first: 10, query },
          { where: { id } },
        );

      for (const query of ["deployment", "世界", "name:Deployment"]) {
        const result = await find(query);
        expect(result.edges.map(({ node }) => node.id)).toEqual([record.id]);
        expect(result.totalCount).toBe(1);
      }
      expect((await find("Deployment", "0")).edges).toEqual([]);
      expect(wrap(record).toObject()).not.toHaveProperty("searchableName");

      if (record instanceof User || record instanceof WorkspaceMember) {
        assert(record.email);
        expect((await find(`email:"${record.email}"`)).totalCount).toBe(1);
        expect(
          (await find(`email:${record.email.slice(0, 5)}*`)).totalCount,
        ).toBe(1);
        expect((await find("name:你*")).totalCount).toBe(1);
      }

      record.name = "上海 Release";
      await em.flush();
      em.clear();
      expect((await find("Deployment")).edges).toEqual([]);
      expect((await find("世界")).edges).toEqual([]);
      expect((await find("release")).totalCount).toBe(1);
      expect((await find("上海")).totalCount).toBe(1);

      const indexes = await em.execute<{ indexdef: string }[]>(
        "select indexdef from pg_indexes where tablename = ?",
        [orm.getMetadata().get<NamedRecord>(entity).tableName],
      );
      expect(
        indexes.some(({ indexdef }) =>
          indexdef.includes("USING gin (searchable_name)"),
        ),
      ).toBe(true);
    },
  );

  it("applies workspace RLS to matching names and connection counts", async () => {
    const em = orm.em.fork();
    const workspace = em.create(Workspace, { name: "Allowed" });
    const other = em.create(Workspace, { name: "Other" });
    const member = em.create(WorkspaceMember, {
      name: "Shared Deployment",
      type: "SERVICE_ACCOUNT",
      workspace,
    });
    const hidden = em.create(WorkspaceMember, {
      name: "Shared Deployment",
      type: "SERVICE_ACCOUNT",
      workspace: other,
    });
    await em.persist([workspace, other, member, hidden]).flush();
    await em.execute("grant select on workspace_member to authenticated");
    const scoped = em.fork({
      session: {
        role: "authenticated",
        variables: { "app.auth.workspace.id": workspace.id },
      },
    });
    const result = await new ConnectionManager(scoped).find(
      WorkspaceMemberConnection,
      { first: 10, query: "deployment" },
    );
    expect(result.edges.map(({ node }) => node.id)).toEqual([member.id]);
    expect(result.totalCount).toBe(1);
  });
});
