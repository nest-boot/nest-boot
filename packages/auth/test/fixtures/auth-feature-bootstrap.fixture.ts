import assert from "node:assert/strict";

import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { Args, ID, Query, Resolver } from "@nest-boot/graphql";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import { Injectable } from "@nestjs/common";
import { Global, Module } from "@nestjs/common";
import { GraphQLModule, GraphQLSchemaHost } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLInputObjectType, GraphQLObjectType } from "graphql";

import { SystemAccountService } from "../../src/admin/services/system-account.service.js";
import { ApiKey } from "../../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../src/api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../../src/api-key/objects/system-api-key.object.js";
import { UserApiKey } from "../../src/api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../src/api-key/objects/workspace-api-key.object.js";
import { ApiKeyAuthenticationService } from "../../src/api-key/services/api-key-authentication.service.js";
import { SystemApiKeyService } from "../../src/api-key/services/system-api-key.service.js";
import { UserApiKeyService } from "../../src/api-key/services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "../../src/api-key/services/workspace-api-key.service.js";
import { hashApiKey } from "../../src/api-key/utils/api-key-credential.util.js";
import { AuthGuard } from "../../src/core/auth.guard.js";
import { AuthModule } from "../../src/core/auth.module.js";
import { User } from "../../src/core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";
import { UserService } from "../../src/core/services/user.service.js";
import { WorkspaceMember } from "../../src/workspace/entities/workspace-member.entity.js";

/** Application-owned subclasses retain ordinary Nest constructor injection. */
@Injectable()
class ApplicationAuthGuard extends AuthGuard {}
@Injectable()
class ApplicationUserApiKeyService extends UserApiKeyService {}

/** An application-owned endpoint whose authorization does not require the admin GraphQL API. */
@Resolver()
class FeatureUserResolver {
  constructor(private readonly users: UserService) {}

  @Query(() => User, { nullable: true })
  async featureUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<User | null> {
    return await this.users.getUser(id);
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

/**
 * Boots the actual module graph, checks optional schema/models, and exercises a session.
 * @param options - Feature configuration being tested.
 * @param expected - Independently specified API and persistence expectations.
 * @param expected.admin - Whether administrative management APIs should exist.
 * @param expected.workspace - Whether workspace identities should exist.
 * @param expected.owners - Credential owner types expected in persistence.
 */
export async function verifyAuthFeatures(
  options: AuthModuleOptions,
  expected: {
    admin: boolean;
    workspace: boolean;
    owners: ("User" | "WorkspaceMember" | "SystemAccount")[];
  },
): Promise<void> {
  const module = await Test.createTestingModule({
    providers: [
      FeatureUserResolver,
      ApplicationAuthGuard,
      ApplicationUserApiKeyService,
    ],
    imports: [
      Infrastructure,
      DatabaseModule.forRoot({
        driver: PgliteDriver,
        dbName: "memory://",
        entities: [],
      }),
      GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true }),
      AuthModule.forRoot<string, string, string, string>({
        secret:
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
        baseURL: "http://localhost:3000",
        emailAndPassword: { requireEmailVerification: false },
        ...options,
        user: {
          ...options.user,
          roles: {
            user: ["user-api-key:read", "user-api-key:write"],
            ...options.user?.roles,
          },
        },
      }),
    ],
  }).compile();
  expect(module.get(ApplicationAuthGuard)).toBeInstanceOf(AuthGuard);
  expect(module.get(ApplicationUserApiKeyService)).toBeInstanceOf(
    UserApiKeyService,
  );
  const app = module.createNestApplication();
  app.useGlobalGuards(app.get(AuthGuard));
  try {
    await app.init();
    const orm = app.get<PgliteORM>(MikroORM);
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
    const schema = app.get(GraphQLSchemaHost).schema;
    const queries = schema.getQueryType()?.getFields();
    const managedOwners = expected.owners.filter(
      (owner) => owner !== "SystemAccount" || expected.admin,
    );
    const systemManagement =
      expected.admin && expected.owners.includes("SystemAccount");
    assert(queries);
    const mutations = schema.getMutationType()?.getFields();
    assert(mutations);
    expect(!!queries.users).toBe(expected.admin);
    expect(!!queries.systemAccounts).toBe(expected.admin);
    expect(!!mutations.impersonateUser).toBe(expected.admin);
    expect(!!mutations.createSystemAccount).toBe(expected.admin);
    expect(!!queries.currentWorkspace).toBe(expected.workspace);
    expect(!!queries.workspaceApiKeys).toBe(
      expected.owners.includes("WorkspaceMember"),
    );
    expect(!!queries.systemApiKeys).toBe(systemManagement);
    expect(!!mutations.createUserApiKey).toBe(expected.owners.includes("User"));
    expect(!!mutations.createWorkspaceApiKey).toBe(
      expected.owners.includes("WorkspaceMember"),
    );
    expect(!!mutations.createSystemApiKey).toBe(systemManagement);
    expect(!!mutations.revokeUserApiKey).toBe(expected.owners.includes("User"));
    expect(!!mutations.revokeWorkspaceApiKey).toBe(
      expected.owners.includes("WorkspaceMember"),
    );
    expect(!!mutations.revokeSystemApiKey).toBe(systemManagement);
    expect(
      !!(schema.getType("User") as GraphQLObjectType).getFields().apiKeys,
    ).toBe(expected.owners.includes("User"));
    expect(schema.getType("ApiKey")).toBeUndefined();
    expect(!!schema.getType("SystemAccount")).toBe(expected.admin);
    for (const [type, identity] of [
      [UserApiKey, "User"],
      [WorkspaceApiKey, "WorkspaceMember"],
      [SystemApiKey, "SystemAccount"],
    ] as const) {
      expect(!!schema.getType(type.name)).toBe(
        managedOwners.includes(identity),
      );
    }
    expect(!!orm.getMetadata().find(ApiKey)).toBe(expected.owners.length > 0);
    expect(!!orm.getMetadata().find(SystemAccount)).toBe(
      expected.admin || expected.owners.includes("SystemAccount"),
    );
    expect(!!orm.getMetadata().find(WorkspaceMember)).toBe(expected.workspace);
    for (const [token, enabled] of [
      [ApiKeyAuthenticationService, expected.owners.length > 0],
      [SystemAccountService, expected.admin],
      [UserApiKeyService, expected.owners.includes("User")],
      [WorkspaceApiKeyService, expected.owners.includes("WorkspaceMember")],
      [SystemApiKeyService, systemManagement],
    ] as const) {
      expect(!!app.get(token)).toBe(enabled);
    }
    for (const scope of ["User", "Workspace", "System"]) {
      const input = schema.getType(`Update${scope}ApiKeyInput`) as
        | GraphQLInputObjectType
        | undefined;
      if (input) {
        expect(input.getFields()).not.toHaveProperty("enabled");
        expect(input.getFields()).not.toHaveProperty("revokedAt");
        const output = schema.getType(`${scope}ApiKey`) as GraphQLObjectType;
        expect(output.getFields()).not.toHaveProperty("enabled");
        expect(output.getFields()).toHaveProperty("revokedAt");
      }
    }
    expect(schema.getType("ApiKeyOwner")).toBeUndefined();

    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    const signup = await fetch(url + "/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Feature user",
        email: "features@example.test",
        password: "valid-password",
      }),
    });
    expect(signup.ok).toBe(true);
    const cookies = signup.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const body = (await signup.json()) as { user: { id: string } };
    const graphql = async (
      query: string,
      variables: Record<string, unknown> = {},
      headers: Record<string, string> = {},
    ) => {
      const response = await fetch(url + "/graphql", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookies,
          ...headers,
        },
        body: JSON.stringify({ query, variables }),
      });
      return (await response.json()) as {
        data?: Record<string, any>;
        errors?: { message: string; extensions?: { code?: string } }[];
      };
    };
    const verifyRevocation = async (
      scope: "User" | "Workspace" | "System",
      created: { apiKey: string; entity: { id: string } },
      headers: Record<string, string> = {},
    ) => {
      const record = await orm.em
        .fork()
        .findOneOrFail(ApiKey, created.entity.id);
      expect(record.revokedAt).toBeNull();
      const operation = `revoke${scope}ApiKey`;
      const source = `mutation($id: ID!) { ${operation}(id: $id) {id revokedAt} }`;
      const revoked = await graphql(
        source,
        { id: record.id },
        scope === "System"
          ? headers
          : {
              ...headers,
              cookie: "",
              authorization: `Bearer ${created.apiKey}`,
            },
      );
      expect(revoked.errors).toBeUndefined();
      const timestamp = revoked.data?.[operation].revokedAt;
      expect(timestamp).toEqual(expect.any(String));
      const repeated = await graphql(source, { id: record.id }, headers);
      expect(repeated.errors).toBeUndefined();
      expect(repeated.data?.[operation].revokedAt).toBe(timestamp);
      const stored = await orm.em.fork().findOneOrFail(ApiKey, record.id);
      expect(stored.revokedAt?.toISOString()).toBe(timestamp);
      expect(stored.permissions).toEqual(record.permissions);
      expect(stored.key).toBe(record.key);
      const rejected = await fetch(url + "/graphql", {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          authorization: `Bearer ${created.apiKey}`,
        },
        body: JSON.stringify({ query: "{ currentUser { id } }" }),
      });
      expect(rejected.status).toBe(401);
      expect(await rejected.json()).toMatchObject({
        message: "API key is revoked",
      });
    };
    expect((await graphql("{ currentUser { id } }")).data?.currentUser.id).toBe(
      body.user.id,
    );
    if (!expected.owners.length) {
      const bearer = await fetch(url + "/graphql", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer disabled-key",
        },
        body: JSON.stringify({ query: "{ currentUser { id } }" }),
      });
      expect(bearer.status).toBe(401);
      expect(await bearer.json()).toMatchObject({
        message: "API keys are disabled",
      });
    }
    if (expected.owners.includes("User")) {
      const key = await graphql(
        'mutation { createUserApiKey(input: { name: "User key" }) { apiKey entity { id user { __typename  id  } } } }',
      );
      expect(key.errors).toBeUndefined();
      expect(key.data?.createUserApiKey.entity.user).toEqual({
        __typename: "User",
        id: body.user.id,
      });
      await verifyRevocation("User", key.data?.createUserApiKey);
    }
    if (expected.workspace) {
      const workspace = await graphql(
        'mutation { createWorkspace(input: {name: "Workspace"}) {id} }',
      );
      expect(workspace.errors).toBeUndefined();
      const workspaceId = workspace.data?.createWorkspace.id;
      assert(workspaceId);
      const workspaceHeaders = { "x-workspace-id": workspaceId };
      const workspaceRoles = await graphql(
        "{ workspaceRoles { role grantable } currentWorkspaceMember { id } }",
        {},
        workspaceHeaders,
      );
      expect(workspaceRoles.errors).toBeUndefined();
      expect(workspaceRoles.data?.workspaceRoles).toContainEqual({
        role: "OWNER",
        grantable: true,
      });
      const reassigned = await graphql(
        "mutation($id: ID!) { setWorkspaceMemberRoles(id: $id, input: {roles: [OWNER]}) { id } }",
        { id: workspaceRoles.data?.currentWorkspaceMember.id },
        workspaceHeaders,
      );
      expect(reassigned.errors).toBeUndefined();
      const invited = await graphql(
        'mutation { createWorkspaceInvitation(input: {email: "invited-owner@example.test", roles: [OWNER]}) { id } }',
        {},
        workspaceHeaders,
      );
      expect(invited.errors).toBeUndefined();
      if (expected.owners.includes("WorkspaceMember")) {
        const key = await graphql(
          'mutation { createWorkspaceApiKey(input: {name: "Workspace key"}) { apiKey entity { id member { __typename  id workspaceId  } } } }',
          {},
          { "x-workspace-id": workspaceId },
        );
        expect(key.errors).toBeUndefined();
        expect(key.data?.createWorkspaceApiKey.entity.member.workspaceId).toBe(
          workspaceId,
        );
        const lists = await graphql(
          "{ currentWorkspaceMember { apiKeys(first: 10) { edges { node { id } } } } workspaceApiKeys(first: 10) { edges { node { id } } } }",
          {},
          { "x-workspace-id": workspaceId },
        );
        expect(lists.errors).toBeUndefined();
        const expectedKeys = [
          { node: { id: key.data?.createWorkspaceApiKey.entity.id } },
        ];
        expect(lists.data?.currentWorkspaceMember.apiKeys.edges).toEqual(
          expectedKeys,
        );
        expect(lists.data?.workspaceApiKeys.edges).toEqual(expectedKeys);
        await verifyRevocation("Workspace", key.data?.createWorkspaceApiKey, {
          "x-workspace-id": workspaceId,
        });
      }
    }
    if (expected.admin) {
      await orm.em
        .fork()
        .nativeUpdate(User, body.user.id, { roles: ["admin"] });
      const roles = await graphql("{ userRoles { role grantable } }");
      expect(roles.errors).toBeUndefined();
      expect(roles.data?.userRoles).toContainEqual({
        role: "ADMIN",
        grantable: true,
      });
      const delegated = await graphql(
        'mutation { createUser(input: {email: "delegated-admin@example.test", name: "Delegated", password: "valid-password", roles: [ADMIN]}) { id } }',
      );
      expect(delegated.errors).toBeUndefined();
      const assigned = await graphql(
        "mutation($id: ID!) { setUserRoles(id: $id, input: {roles: [ADMIN]}) { id } }",
        { id: delegated.data?.createUser.id },
      );
      expect(assigned.errors).toBeUndefined();
      const account = await graphql(
        'mutation { createSystemAccount(input: {name: "System", permissions: [USER__READ]}) {id} }',
      );
      expect(account.errors).toBeUndefined();
      if (expected.owners.includes("SystemAccount")) {
        const key = await graphql(
          'mutation($id: ID!) { createSystemApiKey(systemAccountId: $id, input: {name: "System key", permissions: [USER__READ]}) {apiKey entity {id systemAccount { __typename id }}}}',
          { id: account.data?.createSystemAccount.id },
        );
        expect(key.errors).toBeUndefined();
        expect(key.data?.createSystemApiKey.entity.systemAccount).toEqual({
          __typename: "SystemAccount",
          id: account.data?.createSystemAccount.id,
        });
        await verifyRevocation("System", key.data?.createSystemApiKey);
      }
      const deleted = await graphql(
        "mutation($id: ID!) { deleteSystemAccount(id: $id) {id} }",
        { id: account.data?.createSystemAccount.id },
      );
      expect(deleted.errors).toBeUndefined();
    }
    if (!expected.admin && expected.owners.includes("SystemAccount")) {
      const em = orm.em.fork();
      const account = em.create(SystemAccount, {
        name: "Provisioned machine",
        permissions: ["user:read"],
      });
      const plaintext = "pre-provisioned-system-key";
      const key = em.create(ApiKey, {
        owner: account,
        name: "Provisioned key",
        key: hashApiKey(plaintext),
        permissions: ["user:read"],
      });
      await em.persist([account, key]).flush();
      const machineRequest = () =>
        fetch(url + "/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + plaintext,
          },
          body: JSON.stringify({
            query:
              "query($id: ID!) { featureUser(id: $id) { id } currentAbilityRules { actions subjects } }",
            variables: { id: body.user.id },
          }),
        });
      const machine = await machineRequest();
      expect(machine.status).toBe(200);
      const result = (await machine.json()) as {
        data?: {
          featureUser: { id: string };
          currentAbilityRules: { actions: string[]; subjects: string[] }[];
        };
        errors?: unknown;
      };
      expect(result.errors).toBeUndefined();
      expect(result.data?.featureUser.id).toBe(body.user.id);
      expect(result.data?.currentAbilityRules).toContainEqual({
        actions: ["read"],
        subjects: ["User"],
      });
      await em.nativeUpdate(SystemAccount, account.id, { enabled: false });
      expect((await machineRequest()).status).toBe(401);
      await em.nativeDelete(SystemAccount, account.id);
      expect(await em.count(ApiKey, key.id)).toBe(1);
    }
    // Disabled credential tables must not leave dangling deletion triggers on identities.
    await orm.em.fork().nativeDelete(User, body.user.id);
  } finally {
    await app.close();
  }
}
