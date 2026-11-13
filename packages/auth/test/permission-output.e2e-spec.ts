import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { Query, Resolver } from "@nest-boot/graphql";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import { Global, type INestApplication, Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";

import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../src/api-key/entities/system-account.entity.js";
import { UserApiKey } from "../src/api-key/objects/user-api-key.object.js";
import { hashApiKey } from "../src/api-key/utils/api-key-credential.util.js";
import { getCurrentApiKey } from "../src/api-key/utils/get-current-api-key.util.js";
import { Can } from "../src/common/decorators/can.decorator.js";
import { AuthGuard } from "../src/core/auth.guard.js";
import { AuthModule } from "../src/core/auth.module.js";
import { User } from "../src/core/entities/user.entity.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";

let observedCredential: UserApiKey | undefined;

@Resolver()
class PermissionProbeResolver {
  @Query(() => UserApiKey)
  permissionProbeKey(): UserApiKey {
    const key = getCurrentApiKey();
    if (!(key instanceof UserApiKey)) {
      throw new Error("Expected user key");
    }
    observedCredential = key;
    return key;
  }

  @Can("read", () => "Task")
  @Query(() => Boolean)
  permissionProbeTask(): boolean {
    return true;
  }

  @Can("read", () => "Project")
  @Query(() => Boolean)
  permissionProbeProject(): boolean {
    return true;
  }
}

@Global()
@Module({
  providers: [
    { provide: Mailer, useValue: { sendMail: () => Promise.resolve() } },
    {
      provide: HashService,
      useValue: {
        hash: (value: string) => Promise.resolve("hashed:" + value),
        verify: (hash: string, value: string) =>
          Promise.resolve(hash === "hashed:" + value),
      },
    },
  ],
  exports: [Mailer, HashService],
})
class Infrastructure {}

interface Result {
  data: Record<string, unknown> | null;
  errors?: { message: string }[];
}

describe("permission output after catalog removal", () => {
  let app: INestApplication;
  let orm: PgliteORM;
  let url: string;
  let cookie: string;
  let user: User;
  let member: WorkspaceMember;
  let workspace: Workspace;
  let account: SystemAccount;
  let userKey: ApiKey;
  let workspaceKey: ApiKey;
  let systemKey: ApiKey;

  const query = async (
    source: string,
    headers: Record<string, string> = {},
  ): Promise<Result> => {
    const response = await fetch(url + "/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, ...headers },
      body: JSON.stringify({ query: source }),
    });
    return (await response.json()) as Result;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionProbeResolver],
      imports: [
        Infrastructure,
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
        AuthModule.forRoot({
          secret: "permission-output-test-secret-long-enough",
          baseURL: "http://localhost:3000",
          admin: { enabled: true },
          apiKey: {
            enabled: true,
            user: { enabled: true },
            workspace: { enabled: true },
            system: { enabled: true },
          },
          user: { permissions: ["project:read"] },
          workspace: { enabled: true, permissions: ["task:read"] },
          emailAndPassword: { requireEmailVerification: false },
          buildAbility: (rules) => {
            rules.can({ user: "project:read" }, "read", "Project");
            rules.can({ workspace: "task:read" }, "read", "Task");
          },
        }),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(app.get(AuthGuard));
    await app.init();
    orm = app.get<PgliteORM>(MikroORM);
    await orm.em.execute("create role authenticated nologin noinherit");
    await orm.em.execute("create role anonymous nologin noinherit");
    await orm.em.execute("grant anonymous, authenticated to current_user");
    await orm.em.execute(
      "grant usage on schema public to anonymous, authenticated",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on tables to anonymous, authenticated",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on sequences to anonymous, authenticated",
    );
    await orm.schema.create();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    const signup = await fetch(url + "/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Permission administrator",
        email: "permission-output@example.test",
        password: "valid-password",
      }),
    });
    expect(signup.ok).toBe(true);
    cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const signedUp = (await signup.json()) as { user: { id: string } };
    const em = orm.em.fork();
    user = await em.findOneOrFail(User, signedUp.user.id);
    user.roles = ["admin"];
    user.permissions = ["project:read", "retired:user"];
    workspace = em.create(Workspace, { name: "Permission workspace" });
    member = em.create(WorkspaceMember, {
      name: "Permission member",
      workspace,
      user,
      roles: ["owner"],
      permissions: ["task:read", "retired:workspace"],
    });
    account = em.create(SystemAccount, {
      name: "Permission system",
      permissions: ["user:read", "retired:system"],
    });
    userKey = em.create(ApiKey, {
      name: "User output",
      key: hashApiKey("user-output"),
      owner: user,
      permissions: ["project:read", "retired:key"],
    });
    workspaceKey = em.create(ApiKey, {
      name: "Workspace output",
      key: hashApiKey("workspace-output"),
      owner: member,
      permissions: ["task:read", "retired:key"],
    });
    systemKey = em.create(ApiKey, {
      name: "System output",
      key: hashApiKey("system-output"),
      owner: account,
      permissions: ["user:read", "retired:key"],
    });
    await em
      .persist([
        user,
        workspace,
        member,
        account,
        userKey,
        workspaceKey,
        systemKey,
      ])
      .flush();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  it("serializes all identity and credential permission fields without changing stored grants", async () => {
    const result = await query(
      `{
      currentUser { permissions apiKeys(first: 10) { edges { node { id permissions } } } }
      currentWorkspaceMember { permissions apiKeys(first: 10) { edges { node { id permissions } } } }
      systemAccounts(first: 10) { edges { node { id permissions } } }
      systemApiKeys(first: 10) { edges { node { id permissions } } }
    }`,
      { "x-workspace-id": workspace.id },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      currentUser: {
        permissions: ["PROJECT__READ"],
        apiKeys: {
          edges: [{ node: { id: userKey.id, permissions: ["PROJECT__READ"] } }],
        },
      },
      currentWorkspaceMember: {
        permissions: ["TASK__READ"],
        apiKeys: {
          edges: [
            { node: { id: workspaceKey.id, permissions: ["TASK__READ"] } },
          ],
        },
      },
      systemAccounts: {
        edges: [{ node: { id: account.id, permissions: ["USER__READ"] } }],
      },
      systemApiKeys: {
        edges: [{ node: { id: systemKey.id, permissions: ["USER__READ"] } }],
      },
    });
    const em = orm.em.fork();
    expect((await em.findOneOrFail(User, user.id)).permissions).toEqual([
      "project:read",
      "retired:user",
    ]);
    expect(
      (await em.findOneOrFail(WorkspaceMember, member.id)).permissions,
    ).toEqual(["task:read", "retired:workspace"]);
    expect(
      (await em.findOneOrFail(SystemAccount, account.id)).permissions,
    ).toEqual(["user:read", "retired:system"]);
    for (const key of [userKey, workspaceKey, systemKey]) {
      expect((await em.findOneOrFail(ApiKey, key.id)).permissions).toEqual(
        key.permissions,
      );
    }
  });

  it("keeps a key restricted when every stored grant was removed from the output catalog", async () => {
    const em = orm.em.fork();
    const key = em.create(ApiKey, {
      name: "Retired grants only",
      key: hashApiKey("retired-output"),
      owner: user,
      permissions: ["retired:key"],
    });
    await em.persist(key).flush();
    const headers = { cookie: "", authorization: "Bearer retired-output" };
    const output = await query(
      "{ permissionProbeKey { id permissions } }",
      headers,
    );
    expect(output.errors).toBeUndefined();
    expect(output.data).toEqual({
      permissionProbeKey: { id: key.id, permissions: [] },
    });
    expect(observedCredential?.permissions).toEqual(["retired:key"]);
    const renamed = await query(
      `mutation { updateUserApiKey(id: "${key.id}", input: {name: "Renamed retired key"}) {name permissions} }`,
    );
    expect(renamed.errors).toBeUndefined();
    expect(renamed.data).toEqual({
      updateUserApiKey: { name: "Renamed retired key", permissions: [] },
    });
    const forbidden = await query("{ permissionProbeProject }", headers);
    expect(forbidden.errors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/forbidden|not allowed/i),
      }),
    ]);
    expect((await em.fork().findOneOrFail(ApiKey, key.id)).permissions).toEqual(
      ["retired:key"],
    );
    expect((await query("{ permissionProbeProject }")).data).toEqual({
      permissionProbeProject: true,
    });
  });
  it("renames a retired-only workspace credential without replacing its restriction", async () => {
    const em = orm.em.fork();
    const key = em.create(ApiKey, {
      name: "Retired workspace grants",
      key: hashApiKey("workspace-retired-output"),
      owner: member,
      permissions: ["retired:key"],
    });
    await em.persist(key).flush();
    const renamed = await query(
      `mutation { updateWorkspaceApiKey(id: "${key.id}", input: {name: "Renamed workspace key"}) {name permissions} }`,
      { "x-workspace-id": workspace.id },
    );
    expect(renamed.errors).toBeUndefined();
    expect(renamed.data).toEqual({
      updateWorkspaceApiKey: { name: "Renamed workspace key", permissions: [] },
    });
    expect((await em.fork().findOneOrFail(ApiKey, key.id)).permissions).toEqual(
      ["retired:key"],
    );
    const forbidden = await query("{ permissionProbeTask }", {
      cookie: "",
      authorization: "Bearer workspace-retired-output",
      "x-workspace-id": workspace.id,
    });
    expect(forbidden.errors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/forbidden|not allowed/i),
      }),
    ]);
    expect(
      (
        await query("{ permissionProbeTask }", {
          "x-workspace-id": workspace.id,
        })
      ).data,
    ).toEqual({ permissionProbeTask: true });
  });
});
