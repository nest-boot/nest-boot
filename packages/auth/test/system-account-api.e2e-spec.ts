import assert from "node:assert/strict";

import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import { Global, type INestApplication, Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";

import { AuthGuard } from "../src/auth.guard.js";
import { AuthModule } from "../src/auth.module.js";
import { ApiKeyEntity, User, Workspace } from "../src/entities/index.js";

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
    {
      provide: Mailer,
      useValue: { sendMail: () => Promise.resolve(undefined) },
    },
  ],
  exports: [HashService, Mailer],
})
class InfrastructureModule {}

interface GraphQLResult {
  data?: Record<string, any>;
  errors?: { message: string; extensions: { code?: string } }[];
}

/**
 * Requires a successful GraphQL payload before inspecting its selected fields.
 * @param result - Parsed GraphQL response.
 * @returns Data selected by the request.
 */
function data(result: GraphQLResult): NonNullable<GraphQLResult["data"]> {
  assert.equal(result.errors, undefined);
  assert(result.data);
  return result.data;
}

describe("system-account GraphQL lifecycle over HTTP", () => {
  let app: INestApplication;
  let orm: PgliteORM;
  let baseURL: string;
  let cookies: string;
  let ordinaryCookies: string;
  let workspaceId: string;

  const graphql = async (
    query: string,
    variables: Record<string, unknown> = {},
    credential: string = cookies,
    bearer = false,
  ): Promise<GraphQLResult> => {
    const response = await fetch(baseURL + "/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(credential
          ? bearer
            ? { authorization: `Bearer ${credential}` }
            : { cookie: credential }
          : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    return await (response.json() as Promise<GraphQLResult>);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        InfrastructureModule,
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
        AuthModule.forRoot({
          secret:
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
          baseURL: "http://localhost:3000",
          workspace: { enabled: true },
          emailAndPassword: { requireEmailVerification: false },
        }),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(app.get(AuthGuard));
    await app.init();
    orm = app.get<PgliteORM>(MikroORM);
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
    baseURL = await app.getUrl();
    const signup = async (email: string) => {
      const response = await fetch(baseURL + "/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: email,
          email,
          password: "valid-password",
        }),
      });
      expect(response.ok).toBe(true);
      return {
        cookies: response.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; "),
        body: (await response.json()) as { user: { id: string } },
      };
    };
    const administrator = await signup("administrator@example.test");
    cookies = administrator.cookies;
    await orm.em
      .fork()
      .nativeUpdate(User, administrator.body.user.id, { roles: ["admin"] });
    ordinaryCookies = (await signup("ordinary@example.test")).cookies;
    const workspace = orm.em
      .fork()
      .create(Workspace, { name: "Unjoined workspace" });
    await orm.em.fork().persist(workspace).flush();
    workspaceId = workspace.id;
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });

  it("requires a human administrator session and rejects unauthenticated callers", async () => {
    const mutation =
      'mutation { createSystemAccount(input: {name: "Denied"}) { id } }';
    expect((await graphql(mutation, {}, "")).errors?.[0]?.extensions.code).toBe(
      "UNAUTHENTICATED",
    );
    expect(
      (await graphql(mutation, {}, ordinaryCookies)).errors?.[0]?.extensions
        .code,
    ).toBe("FORBIDDEN");
  });

  it("creates, manages, uses, revokes and deletes independent credentials over HTTP", async () => {
    const account = await graphql(
      'mutation { createSystemAccount(input: {name: "Integration", permissions: [USER__READ, WORKSPACE__READ_ANY]}) { id name enabled createdById permissions } }',
    );
    expect(account.errors).toBeUndefined();
    const accountId: string = data(account).createSystemAccount.id;
    expect(data(account).createSystemAccount).toMatchObject({
      name: "Integration",
      enabled: true,
      createdById: expect.any(String),
      permissions: ["USER__READ", "WORKSPACE__READ_ANY"],
    });
    const key = await graphql(
      'mutation($id: ID!) { createSystemAccountApiKey(systemAccountId: $id, input: {name: "Deployment", permissions: [USER__READ, WORKSPACE__READ_ANY]}) { apiKey entity { id name systemAccountId createdById } } }',
      { id: accountId },
    );
    expect(key.errors).toBeUndefined();
    const keyId: string = data(key).createSystemAccountApiKey.entity.id;
    const plaintext: string = data(key).createSystemAccountApiKey.apiKey;
    expect(plaintext).toMatch(/^sys_[A-Za-z0-9_-]{64}$/u);
    expect(data(key).createSystemAccountApiKey.entity.systemAccountId).toBe(
      accountId,
    );
    const stored = await orm.em.fork().findOneOrFail(ApiKeyEntity, keyId);
    expect(stored.key).not.toBe(plaintext);
    expect(stored.key).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    const result = await graphql(
      "query($id: ID!, $key: ID!) { systemAccounts(first: 10) { totalCount edges { node { id } } } systemAccount(id: $id) { id apiKeys(first: 10) { totalCount edges { node { id name systemAccountId createdById } } } } systemAccountApiKey(id: $key) { id name } }",
      { id: accountId, key: keyId },
    );
    expect(result.errors).toBeUndefined();
    expect(data(result).systemAccounts.totalCount).toBe(1);
    expect(data(result).systemAccount.apiKeys.edges[0].node.id).toBe(keyId);
    expect(
      data(result).systemAccount.apiKeys.edges[0].node.createdById,
    ).toEqual(expect.any(String));
    expect(JSON.stringify(result)).not.toContain(plaintext);
    expect(
      data(
        await graphql(
          '{ __type(name: "SystemAccountApiKey") { fields { name } } }',
        ),
      ).__type.fields.map((field: { name: string }) => field.name),
    ).not.toContain("key");

    const access = await graphql(
      "query($id: ID!) { users(first: 10) { totalCount } workspaces(first: 10) { edges { node { id } } } platformWorkspace(id: $id) { id } }",
      { id: workspaceId },
      plaintext,
      true,
    );
    expect(access.errors).toBeUndefined();
    expect(data(access).users.totalCount).toBe(2);
    expect(data(access).platformWorkspace.id).toBe(workspaceId);
    expect(
      (await graphql("{ currentUser { id } }", {}, plaintext, true)).errors?.[0]
        ?.extensions.code,
    ).toBe("FORBIDDEN");
    const denied = await graphql(
      'mutation { createSystemAccount(input: {name: "Escalation"}) { id } }',
      {},
      plaintext,
      true,
    );
    expect(denied.errors?.[0]?.extensions.code).toBe("FORBIDDEN");

    const changed = await graphql(
      'mutation($id: ID!) { updateSystemAccountApiKey(id: $id, input: {name: "Renamed", permissions: [USER__READ]}) { id name permissions } }',
      { id: keyId },
    );
    expect(changed.errors).toBeUndefined();
    expect(data(changed).updateSystemAccountApiKey.name).toBe("Renamed");
    const readOnly = await graphql(
      "{ workspaces(first: 1) { totalCount } }",
      {},
      plaintext,
      true,
    );
    expect(readOnly.errors?.[0]?.extensions.code).toBe("FORBIDDEN");
    const disabled = await graphql(
      "mutation($id: ID!) { updateSystemAccount(id: $id, input: {enabled: false}) { id enabled } }",
      { id: accountId },
    );
    expect(disabled.errors).toBeUndefined();
    const response = await fetch(baseURL + "/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${plaintext}`,
      },
      body: JSON.stringify({ query: "{ users(first: 1) { totalCount } }" }),
    });
    expect(response.status).toBe(401);

    const removed = await graphql(
      "mutation($id: ID!) { deleteSystemAccountApiKey(id: $id) { id } }",
      { id: keyId },
    );
    expect(removed.errors).toBeUndefined();
    expect(await orm.em.fork().count(ApiKeyEntity, keyId)).toBe(0);
    const deletedAccount = await graphql(
      "mutation($id: ID!) { deleteSystemAccount(id: $id) { id } }",
      { id: accountId },
    );
    expect(deletedAccount.errors).toBeUndefined();
    expect(data(deletedAccount).deleteSystemAccount.id).toBe(accountId);
  });
});
