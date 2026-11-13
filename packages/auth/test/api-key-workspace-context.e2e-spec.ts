import { EntityManager, type Opt, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import { MikroORM, PgliteDriver } from "@mikro-orm/pglite";
import type { SqlEntityManager } from "@mikro-orm/sql";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Global,
  type INestApplication,
  Inject,
  Module,
  Post,
} from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";

import { AuthApiKey } from "../src/api-key/decorators/auth-api-key.decorator.js";
import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../src/api-key/entities/system-account.entity.js";
import type { ApiKeyObject } from "../src/api-key/objects/api-key.object.js";
import { hashApiKey } from "../src/api-key/utils/api-key-credential.util.js";
import { Public } from "../src/common/decorators/public.decorator.js";
import { workspaceScopePolicy } from "../src/common/policies/workspace-scope.policy.js";
import { authorize } from "../src/common/utils/authorize.util.js";
import { AuthGuard } from "../src/core/auth.guard.js";
import { AuthModule } from "../src/core/auth.module.js";
import { AuthContext } from "../src/core/auth-context.js";
import { AuthSession } from "../src/core/decorators/auth-session.decorator.js";
import { Session } from "../src/core/entities/session.entity.js";
import { User } from "../src/core/entities/user.entity.js";
import { AuthWorkspace } from "../src/workspace/decorators/auth-workspace.decorator.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

@Entity({
  policies: [
    workspaceScopePolicy({ property: "workspaceId" }),
    {
      command: "select",
      roles: ["authenticated", "anonymous"],
      using: `"is_public" = true AND "workspace_id" = nullif(current_setting('app.selected.workspace.id', true), '')::bigint`,
    },
  ],
})
class WorkspaceResource {
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = crypto.randomUUID();

  @Property({ type: t.bigint })
  workspaceId!: string;

  @Property({ type: t.boolean })
  isPublic: Opt<boolean> = false;
}

/** An ordinary workspace API shared by human sessions and system credentials. */
@Controller("workspace-resources")
class WorkspaceResourceController {
  constructor(
    @Inject(EntityManager) private readonly em: SqlEntityManager,
    private readonly context: AuthContext,
  ) {}

  @Get("context")
  @Public()
  async identity() {
    return {
      workspace: this.context.selectedWorkspace?.id ?? null,
      user: this.context.user?.id ?? null,
      member: this.context.member?.id ?? null,
      sql: await this.em.execute(
        "select current_setting('app.auth.workspace.id', true) as workspace, current_setting('app.auth.user.id', true) as user, current_setting('app.auth.workspace_member.id', true) as member, current_user as role, current_setting('app.selected.workspace.id', true) as selected",
      ),
    };
  }

  @Get("credential")
  @Public()
  credential(
    @AuthApiKey() apiKey: ApiKeyObject | null,
    @AuthSession() session: Session | null,
  ) {
    return {
      keyId: apiKey?.id ?? null,
      ownerType: apiKey?.ownerType ?? null,
      sessionId: session?.id ?? null,
    };
  }

  @Get()
  async list() {
    authorize("read", WorkspaceResource);
    // Deliberately query without a workspace filter to verify native RLS.
    return await this.em.find(WorkspaceResource, {});
  }

  @Post()
  async create(@AuthWorkspace() workspace: Workspace | null) {
    if (!workspace) {
      if (!this.context.selectedWorkspace) {
        throw new BadRequestException("Select a workspace");
      }
      throw new ForbiddenException("A workspace identity is required");
    }
    const resource = this.em.create(WorkspaceResource, {
      workspaceId: workspace.id,
    });
    authorize("write", resource);
    await this.em.persist(resource).flush();
    return resource;
  }

  @Post("clear-authentication")
  async clearAuthentication() {
    this.context.clear();
    return {
      identity: await this.identity(),
      resources: await this.publicResources(),
    };
  }

  @Get("public")
  @Public()
  async publicResources() {
    const workspace = this.context.selectedWorkspace;
    if (!workspace) {
      throw new BadRequestException("Select a workspace");
    }
    return await this.em.find(WorkspaceResource, {
      workspaceId: workspace.id,
      isPublic: true,
    });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: HashService,
      useValue: {
        hash: (value: string) => Promise.resolve("hashed:" + value),
        verify: (hash: string, value: string) =>
          Promise.resolve(hash === "hashed:" + value),
      },
    },
    { provide: Mailer, useValue: { sendMail: () => Promise.resolve() } },
  ],
  exports: [HashService, Mailer],
})
class InfrastructureModule {}

describe("workspace selection independently of authentication", () => {
  let app: INestApplication;
  let orm: MikroORM;
  let url: string;
  let workspaces: Workspace[];
  let account: SystemAccount;
  let user: User;
  let cookies: string;
  let key: string;
  let readKey: string;
  let emptyKey: string;
  let oversizedKey: string;
  let userKey: string;
  let workspaceKey: string;
  let serviceKey: string;

  const request = (
    path: string,
    credential: string,
    workspaceId?: string,
    method = "GET",
    session = false,
    workspaceCookie?: string,
  ) =>
    fetch(url + path, {
      method,
      headers: {
        ...(credential && !session
          ? { authorization: `Bearer ${credential}` }
          : {}),
        ...((session && credential) || workspaceCookie !== undefined
          ? {
              cookie: [
                session ? credential : "",
                workspaceCookie === undefined
                  ? ""
                  : `workspace_id=${encodeURIComponent(workspaceCookie)}`,
              ]
                .filter(Boolean)
                .join("; "),
            }
          : {}),
        ...(workspaceId !== undefined ? { "x-workspace-id": workspaceId } : {}),
      },
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        InfrastructureModule,
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [WorkspaceResource],
        }),
        GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
        AuthModule.forRoot(
          withAuthTestFeatures({
            secret:
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
            baseURL: "http://localhost:3000",
            emailAndPassword: { requireEmailVerification: false },
            workspace: {
              enabled: true,
              permissions: ["resource:read", "resource:write"],
              roles: { owner: ["resource:read", "resource:write"] },
            },
            buildAbility: ({ can }, { workspace }) => {
              if (!workspace) {
                return;
              }
              const condition = { workspaceId: workspace.id };
              can(
                { workspace: "resource:read" },
                "read",
                WorkspaceResource,
                condition,
              );
              can(
                { workspace: "resource:write" },
                "write",
                WorkspaceResource,
                condition,
              );
              can(
                { user: "workspace:read-any" },
                "read",
                WorkspaceResource,
                condition,
              );
              can(
                { user: "workspace:update-any" },
                "write",
                WorkspaceResource,
                condition,
              );
            },
          }),
        ),
      ],
      controllers: [WorkspaceResourceController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(app.get(AuthGuard));
    await app.init();
    orm = app.get(MikroORM);
    await orm.em.execute("create role authenticated nologin noinherit");
    await orm.em.execute("create role anonymous nologin noinherit");
    await orm.em.execute("grant authenticated, anonymous to current_user");
    await orm.em.execute(
      "grant usage on schema public to authenticated, anonymous",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on tables to authenticated, anonymous",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on sequences to authenticated, anonymous",
    );
    await orm.schema.create();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    const signup = await fetch(url + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Human",
        email: "human@example.test",
        password: "valid-password",
      }),
    });
    expect(signup.ok).toBe(true);
    cookies = signup.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const body = (await signup.json()) as { user: { id: string } };
    const em = orm.em.fork();
    user = await em.findOneOrFail(User, body.user.id);
    workspaces = [
      em.create(Workspace, { name: "First" }),
      em.create(Workspace, { name: "Second" }),
    ];
    account = em.create(SystemAccount, {
      name: "Machine",
      permissions: ["workspace:read-any", "workspace:update-any"],
    });
    const reader = em.create(SystemAccount, {
      name: "Reader",
      permissions: ["workspace:read-any"],
    });
    const credentials = [
      [account, ["workspace:read-any", "workspace:update-any"]],
      [account, ["workspace:read-any"]],
      [account, []],
      [reader, ["workspace:read-any", "workspace:update-any"]],
    ] as const;
    const plaintexts = credentials.map(() => "sys_" + crypto.randomUUID());
    [key, readKey, emptyKey, oversizedKey] = plaintexts;
    const keys = credentials.map(([owner, permissions], index) =>
      em.create(ApiKey, {
        owner,
        name: "Machine key",
        key: hashApiKey(plaintexts[index]),
        permissions: [...permissions],
      }),
    );
    const member = em.create(WorkspaceMember, {
      name: user.name,
      user,
      workspace: workspaces[0],
      roles: ["owner"],
    });
    const serviceMember = em.create(WorkspaceMember, {
      name: "Service",
      type: "SERVICE_ACCOUNT",
      workspace: workspaces[0],
      roles: ["owner"],
    });
    userKey = "user_" + crypto.randomUUID();
    const personalKey = em.create(ApiKey, {
      owner: user,
      name: "Personal key",
      key: hashApiKey(userKey),
      permissions: [],
    });
    workspaceKey = "workspace_" + crypto.randomUUID();
    serviceKey = "service_" + crypto.randomUUID();
    const memberKeys = [member, serviceMember].map((owner, index) =>
      em.create(ApiKey, {
        owner,
        name: "Workspace key",
        key: hashApiKey(index ? serviceKey : workspaceKey),
        permissions: [],
      }),
    );
    await em
      .persist([
        ...workspaces,
        account,
        reader,
        ...keys,
        member,
        serviceMember,
        ...memberKeys,
        personalKey,
      ])
      .flush();
  });

  afterEach(async () => {
    await orm.em.fork().nativeDelete(WorkspaceResource, {});
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    "anonymous",
    "session",
    "user-key",
    "workspace-key",
    "service-key",
    "system-key",
    "session-over-key",
  ])(
    "injects only the credential used for authentication (%s)",
    async (identity) => {
      const credential =
        identity === "anonymous"
          ? ""
          : identity === "session"
            ? cookies
            : identity === "user-key"
              ? userKey
              : identity === "workspace-key"
                ? workspaceKey
                : identity === "service-key"
                  ? serviceKey
                  : key;
      const response =
        identity === "session-over-key"
          ? await fetch(url + "/workspace-resources/credential", {
              headers: { authorization: `Bearer ${key}`, cookie: cookies },
            })
          : await request(
              "/workspace-resources/credential",
              credential,
              undefined,
              "GET",
              identity === "session",
            );
      expect(response.status).toBe(200);
      const body = await response.json();
      const session = identity === "session" || identity === "session-over-key";
      expect(body.sessionId).toEqual(session ? expect.any(String) : null);
      expect(body.keyId).toEqual(
        identity === "anonymous" || session ? null : expect.any(String),
      );
      expect(body.ownerType).toBe(
        identity === "anonymous" || session
          ? null
          : identity === "user-key"
            ? "user"
            : identity === "system-key"
              ? "system_account"
              : "workspace_member",
      );
    },
  );

  it("selects either workspace without manufacturing a user or membership and isolates concurrent requests", async () => {
    await Promise.all(
      workspaces.map(async (workspace) => {
        const response = await request(
          "/workspace-resources/context",
          key,
          workspace.id,
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          workspace: workspace.id,
          user: null,
          member: null,
          sql: [
            {
              workspace: workspace.id,
              user: "",
              member: "",
              role: "authenticated",
              selected: workspace.id,
            },
          ],
        });
        const graphql = await fetch(url + "/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
            "x-workspace-id": workspace.id,
          },
          body: JSON.stringify({
            query:
              "{ selectedWorkspace { id } currentWorkspace { id } currentWorkspaceMember { id } }",
          }),
        });
        expect(await graphql.json()).toEqual({
          data: {
            selectedWorkspace: { id: workspace.id },
            currentWorkspace: { id: workspace.id },
            currentWorkspaceMember: null,
          },
        });
      }),
    );
  });

  it("reuses the same create API for a human session and a system credential", async () => {
    const human = await request(
      "/workspace-resources",
      cookies,
      workspaces[0].id,
      "POST",
      true,
    );
    expect(human.status).toBe(201);
    expect(await human.json()).toMatchObject({ workspaceId: workspaces[0].id });
    const machine = await request(
      "/workspace-resources",
      key,
      workspaces[1].id,
      "POST",
    );
    expect(machine.status).toBe(201);
    expect(await machine.json()).toMatchObject({
      workspaceId: workspaces[1].id,
    });
    expect(
      await orm.em.fork().count(WorkspaceMember, { workspace: workspaces[1] }),
    ).toBe(0);
  });

  it.each(
    ["anonymous", "session", "user-key", "workspace-key", "system-key"].flatMap(
      (identity) => [
        { identity, source: "header" },
        { identity, source: "cookie" },
        { identity, source: "header-wins" },
        { identity, source: "empty-header" },
        { identity, source: "unknown-header" },
      ],
    ),
  )(
    "selects through $source independently of $identity authentication",
    async ({ identity, source }) => {
      const credential =
        identity === "anonymous"
          ? ""
          : identity === "session"
            ? cookies
            : identity === "user-key"
              ? userKey
              : identity === "workspace-key"
                ? workspaceKey
                : key;
      const header =
        source === "cookie"
          ? undefined
          : source === "empty-header"
            ? ""
            : source === "unknown-header"
              ? "999999999999999"
              : workspaces[1].id;
      const cookie = source === "header" ? undefined : workspaces[0].id;
      const expected =
        source === "empty-header" || source === "unknown-header"
          ? null
          : source === "cookie"
            ? workspaces[0].id
            : workspaces[1].id;
      const response = await request(
        "/workspace-resources/context",
        credential,
        header,
        "GET",
        identity === "session",
        cookie,
      );
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.workspace).toBe(expected);
      expect(result.sql[0].selected).toBe(expected ?? "");
      const hasMember =
        expected === workspaces[0].id &&
        ["session", "user-key", "workspace-key"].includes(identity);
      expect(result.member).toEqual(hasMember ? expect.any(String) : null);
      expect(result.sql[0].workspace).toBe(
        hasMember || identity === "system-key" ? (expected ?? "") : "",
      );
    },
  );

  it.each(["header", "cookie"])(
    "rejects a malformed %s selector without treating it as a credential failure",
    async (source) => {
      const response = await request(
        "/workspace-resources/context",
        key,
        source === "header" ? "invalid-id" : undefined,
        "GET",
        false,
        source === "cookie" ? "invalid-id" : workspaces[0].id,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: "Invalid workspace ID",
      });
    },
  );

  it.each(["anonymous", "non-member", "unprivileged-system"])(
    "allows a %s request to select a workspace without granting resource access",
    async (identity) => {
      const credential =
        identity === "anonymous"
          ? ""
          : identity === "non-member"
            ? cookies
            : emptyKey;
      const workspace = workspaces[1];
      const response = await request(
        "/workspace-resources/context",
        credential,
        workspace.id,
        "GET",
        identity === "non-member",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        workspace: workspace.id,
        user: identity === "non-member" ? user.id : null,
        member: null,
      });
      const denied = await request(
        "/workspace-resources",
        credential,
        workspace.id,
        "POST",
        identity === "non-member",
      );
      expect(denied.status).toBe(identity === "anonymous" ? 401 : 403);
      expect(await orm.em.fork().count(WorkspaceResource)).toBe(0);
    },
  );

  it("applies native workspace RLS even when the business query has no workspace filter", async () => {
    const em = orm.em.fork();
    await em
      .persist(
        workspaces.map((workspace) =>
          em.create(WorkspaceResource, { workspaceId: workspace.id }),
        ),
      )
      .flush();
    for (const workspace of workspaces) {
      const response = await request("/workspace-resources", key, workspace.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        { id: expect.any(String), workspaceId: workspace.id, isPublic: false },
      ]);
    }
  });

  it.each(["missing", "unknown"])(
    "keeps a %s workspace unset and cannot create a resource",
    async (selected) => {
      const id = selected === "unknown" ? "999999999999999" : undefined;
      const response = await request("/workspace-resources/context", key, id);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        workspace: null,
        user: null,
        member: null,
        sql: [
          {
            workspace: "",
            user: "",
            member: "",
            role: "authenticated",
            selected: "",
          },
        ],
      });
      expect(
        (await request("/workspace-resources", key, id, "POST")).status,
      ).toBe(400);
    },
  );

  it.each([
    "anonymous",
    "non-member",
    "user-key",
    "workspace-key",
    "service-key",
  ])(
    "allows %s to read public resources in an independently selected workspace",
    async (identity) => {
      const em = orm.em.fork();
      const resource = em.create(WorkspaceResource, {
        workspaceId: workspaces[1].id,
        isPublic: true,
      });
      await em
        .persist([
          resource,
          em.create(WorkspaceResource, { workspaceId: workspaces[1].id }),
          em.create(WorkspaceResource, {
            workspaceId: workspaces[0].id,
            isPublic: true,
          }),
        ])
        .flush();
      const credential =
        identity === "anonymous"
          ? ""
          : identity === "non-member"
            ? cookies
            : identity === "user-key"
              ? userKey
              : identity === "workspace-key"
                ? workspaceKey
                : serviceKey;
      const response = await request(
        "/workspace-resources/public",
        credential,
        workspaces[1].id,
        "GET",
        identity === "non-member",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        { id: resource.id, workspaceId: workspaces[1].id, isPublic: true },
      ]);
      if (identity.endsWith("key")) {
        const context = await request(
          "/workspace-resources/context",
          credential,
          workspaces[1].id,
        );
        expect(await context.json()).toMatchObject({
          workspace: workspaces[1].id,
          member: null,
        });
        expect(
          (
            await request(
              "/workspace-resources",
              credential,
              workspaces[1].id,
              "POST",
            )
          ).status,
        ).toBe(403);
        const stored = await em.findOneOrFail(
          ApiKey,
          { key: hashApiKey(credential) },
          { refresh: true },
        );
        expect(stored.lastUsedAt).toBeInstanceOf(Date);
      }
    },
  );

  it.each(["user-key", "workspace-key", "service-key"])(
    "requires explicit workspace selection for %s private access",
    async (identity) => {
      const credential =
        identity === "user-key"
          ? userKey
          : identity === "workspace-key"
            ? workspaceKey
            : serviceKey;
      const withoutSelection = await request(
        "/workspace-resources/context",
        credential,
      );
      expect(withoutSelection.status).toBe(200);
      expect(await withoutSelection.json()).toMatchObject({
        workspace: null,
        member: null,
      });
      const noWorkspace = await request(
        "/workspace-resources",
        credential,
        undefined,
        "POST",
      );
      expect(noWorkspace.status).toBe(400);
      const created = await request(
        "/workspace-resources",
        credential,
        workspaces[0].id,
        "POST",
      );
      expect(created.status).toBe(201);
      expect(await created.json()).toMatchObject({
        workspaceId: workspaces[0].id,
      });
    },
  );

  it("retains public workspace selection after clearing all authentication and private scope", async () => {
    const em = orm.em.fork();
    const resource = em.create(WorkspaceResource, {
      workspaceId: workspaces[0].id,
      isPublic: true,
    });
    await em
      .persist([
        resource,
        em.create(WorkspaceResource, { workspaceId: workspaces[0].id }),
      ])
      .flush();
    const response = await request(
      "/workspace-resources/clear-authentication",
      key,
      workspaces[0].id,
      "POST",
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      identity: {
        workspace: workspaces[0].id,
        user: null,
        member: null,
        sql: [
          {
            workspace: "",
            user: "",
            member: "",
            role: "anonymous",
            selected: workspaces[0].id,
          },
        ],
      },
      resources: [
        { id: resource.id, workspaceId: workspaces[0].id, isPublic: true },
      ],
    });
  });

  it.each(["key", "account", "empty"])(
    "does not elevate %s permissions when a workspace is selected",
    async (ceiling) => {
      const credential =
        ceiling === "key"
          ? readKey
          : ceiling === "account"
            ? oversizedKey
            : emptyKey;
      expect(
        (
          await request(
            "/workspace-resources",
            credential,
            workspaces[0].id,
            "POST",
          )
        ).status,
      ).toBe(403);
      expect(await orm.em.fork().count(WorkspaceResource)).toBe(0);
    },
  );
});
