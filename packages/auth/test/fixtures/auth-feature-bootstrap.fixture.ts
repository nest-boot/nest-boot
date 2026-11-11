import assert from "node:assert/strict";

import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { Args, ID, Query, Resolver } from "@nest-boot/graphql";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import { Global, Module } from "@nestjs/common";
import { GraphQLModule, GraphQLSchemaHost } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLObjectType, GraphQLUnionType } from "graphql";

import { AuthGuard } from "../../src/auth.guard.js";
import { AuthModule } from "../../src/auth.module.js";
import type { AuthModuleOptions } from "../../src/auth-module-options.interface.js";
import {
  ApiKeyEntity,
  Member,
  SystemAccount,
  User,
} from "../../src/entities/index.js";
import { ApiKeyAuthenticationService } from "../../src/infrastructure/api-key-authentication.service.js";
import { SystemAccountService } from "../../src/services/system-account.service.js";
import { SystemApiKeyService } from "../../src/services/system-api-key.service.js";
import { UserService } from "../../src/services/user.service.js";
import { UserApiKeyService } from "../../src/services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "../../src/services/workspace-api-key.service.js";
import { hashApiKey } from "../../src/utils/api-key-credential.util.js";

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
    owners: ("User" | "Member" | "SystemAccount")[];
  },
): Promise<void> {
  const module = await Test.createTestingModule({
    providers: [FeatureUserResolver],
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
    expect(!!queries.workspaceApiKeys).toBe(expected.owners.includes("Member"));
    expect(!!queries.systemApiKeys).toBe(systemManagement);
    expect(!!mutations.createUserApiKey).toBe(expected.owners.includes("User"));
    expect(!!mutations.createMemberApiKey).toBe(
      expected.owners.includes("Member"),
    );
    expect(!!mutations.createSystemAccountApiKey).toBe(systemManagement);
    expect(
      !!(schema.getType("User") as GraphQLObjectType).getFields().apiKeys,
    ).toBe(expected.owners.includes("User"));
    expect(!!schema.getType("ApiKey")).toBe(managedOwners.length > 0);
    expect(!!schema.getType("SystemAccount")).toBe(expected.admin);
    expect(!!orm.getMetadata().find(ApiKeyEntity)).toBe(
      expected.owners.length > 0,
    );
    expect(!!orm.getMetadata().find(SystemAccount)).toBe(
      expected.admin || expected.owners.includes("SystemAccount"),
    );
    expect(!!orm.getMetadata().find(Member)).toBe(expected.workspace);
    for (const [token, enabled] of [
      [ApiKeyAuthenticationService, expected.owners.length > 0],
      [SystemAccountService, expected.admin],
      [UserApiKeyService, expected.owners.includes("User")],
      [WorkspaceApiKeyService, expected.owners.includes("Member")],
      [SystemApiKeyService, systemManagement],
    ] as const) {
      expect(!!app.get(token)).toBe(enabled);
    }
    if (managedOwners.length) {
      expect(
        (schema.getType("ApiKeyOwner") as GraphQLUnionType)
          .getTypes()
          .map(({ name }) => name)
          .sort(),
      ).toEqual([...managedOwners].sort());
    } else {
      expect(schema.getType("ApiKeyOwner")).toBeUndefined();
    }

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
        'mutation { createUserApiKey(input: { name: "User key" }) { apiKey entity { id owner { __typename ... on User { id } } } } }',
      );
      expect(key.errors).toBeUndefined();
      expect(key.data?.createUserApiKey.entity.owner).toEqual({
        __typename: "User",
        id: body.user.id,
      });
    }
    if (expected.workspace) {
      const workspace = await graphql(
        'mutation { createWorkspace(input: {name: "Workspace"}) {id} }',
      );
      expect(workspace.errors).toBeUndefined();
      const workspaceId = workspace.data?.createWorkspace.id;
      assert(workspaceId);
      if (expected.owners.includes("Member")) {
        const key = await graphql(
          'mutation { createMemberApiKey(input: {name: "Workspace key"}) { apiKey entity { id owner { __typename ... on Member { id workspaceId } } } } }',
          {},
          { "x-workspace-id": workspaceId },
        );
        expect(key.errors).toBeUndefined();
        expect(key.data?.createMemberApiKey.entity.owner.workspaceId).toBe(
          workspaceId,
        );
        const lists = await graphql(
          "{ currentMember { apiKeys(first: 10) { edges { node { id } } } } workspaceApiKeys(first: 10) { edges { node { id } } } }",
          {},
          { "x-workspace-id": workspaceId },
        );
        expect(lists.errors).toBeUndefined();
        const expectedKeys = [
          { node: { id: key.data?.createMemberApiKey.entity.id } },
        ];
        expect(lists.data?.currentMember.apiKeys.edges).toEqual(expectedKeys);
        expect(lists.data?.workspaceApiKeys.edges).toEqual(expectedKeys);
      }
    }
    if (expected.admin) {
      await orm.em
        .fork()
        .nativeUpdate(User, body.user.id, { roles: ["admin"] });
      const account = await graphql(
        'mutation { createSystemAccount(input: {name: "System", permissions: [USER__READ]}) {id} }',
      );
      expect(account.errors).toBeUndefined();
      if (expected.owners.includes("SystemAccount")) {
        const key = await graphql(
          'mutation($id: ID!) { createSystemAccountApiKey(systemAccountId: $id, input: {name: "System key", permissions: [USER__READ]}) {apiKey entity {id owner {__typename ... on SystemAccount {id}}}}}',
          { id: account.data?.createSystemAccount.id },
        );
        expect(key.errors).toBeUndefined();
        expect(key.data?.createSystemAccountApiKey.entity.owner).toEqual({
          __typename: "SystemAccount",
          id: account.data?.createSystemAccount.id,
        });
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
      const key = em.create(ApiKeyEntity, {
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
      expect(await em.count(ApiKeyEntity, key.id)).toBe(0);
    }
    // Disabled credential tables must not leave dangling deletion triggers on identities.
    await orm.em.fork().nativeDelete(User, body.user.id);
  } finally {
    await app.close();
  }
}
