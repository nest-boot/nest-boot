import { createHash } from "node:crypto";

import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { ApolloDriver } from "@nestjs/apollo";
import { Global, Module } from "@nestjs/common";
import { GraphQLModule, GraphQLSchemaHost } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";
import type { betterAuth } from "better-auth";
import type { GraphQLEnumType, GraphQLObjectType } from "graphql";

import { ApiKey } from "../../src/api-key/entities/api-key.entity.js";
import { ApiKeyAuthenticationService } from "../../src/api-key/services/api-key-authentication.service.js";
import { WorkspaceApiKeyService } from "../../src/api-key/services/workspace-api-key.service.js";
import { AuthModule } from "../../src/core/auth.module.js";
import { AUTH_TOKEN } from "../../src/core/constants/auth.constants.js";
import { User } from "../../src/core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";
import { Workspace } from "../../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../src/workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "../../src/workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "../../src/workspace/services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "../../src/workspace/services/workspace-member.service.js";
import { withAuthTestFeatures } from "./enabled-auth-features.fixture.js";

/**
 * Boots one isolated Auth application and verifies persistence, login, API keys and schema exposure.
 * @param workspace - Workspace feature settings under test.
 * @param asyncOptions - Whether options are resolved through injected async configuration.
 */
export async function verifyAuthBootstrap(
  workspace: AuthModuleOptions["workspace"],
  asyncOptions: boolean,
) {
  const options: AuthModuleOptions = withAuthTestFeatures({
    secret: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    baseURL: "http://localhost:3000",
    workspace,
    emailAndPassword: { requireEmailVerification: false },
    middleware: { register: false },
  });
  @Global()
  @Module({
    providers: [
      {
        provide: HashService,
        useValue: {
          hash: vi.fn(
            async (value: string) => await Promise.resolve("hashed:" + value),
          ),
          verify: vi.fn(
            async (hash: string, value: string) =>
              await Promise.resolve(hash === "hashed:" + value),
          ),
        },
      },
      { provide: Mailer, useValue: { sendMail: vi.fn() } },
    ],
    exports: [HashService, Mailer],
  })
  class InfrastructureModule {}

  const optionsToken = Symbol("auth options");
  @Module({
    providers: [{ provide: optionsToken, useValue: options }],
    exports: [optionsToken],
  })
  class OptionsModule {}
  const factory = vi.fn(
    async (value: AuthModuleOptions) => await Promise.resolve(value),
  );
  const moduleRef = await Test.createTestingModule({
    imports: [
      InfrastructureModule,
      DatabaseModule.forRoot({
        driver: PgliteDriver,
        dbName: "memory://",
        entities: [],
      }),
      GraphQLModule.forRoot({
        driver: ApolloDriver,
        autoSchemaFile: true,
      }),
      asyncOptions
        ? AuthModule.forRootAsync({
            imports: [OptionsModule],
            inject: [optionsToken],
            useFactory: factory,
          })
        : AuthModule.forRoot(withAuthTestFeatures(options)),
    ],
  }).compile();
  const orm = moduleRef.get<PgliteORM>(MikroORM);
  const app = moduleRef.createNestApplication();
  try {
    await app.init();
    expect(factory).toHaveBeenCalledTimes(asyncOptions ? 1 : 0);
    await orm.em.execute("create role authenticated nologin");
    await orm.em.execute("create role anonymous nologin");
    await orm.schema.create();
    const schema = app.get(GraphQLSchemaHost).schema;
    const enabled = workspace?.enabled === true;
    expect(orm.getMetadata().has(Workspace)).toBe(enabled);
    expect(orm.getMetadata().has(WorkspaceMember)).toBe(enabled);
    const expected = (
      enabled
        ? [
            "user",
            "account",
            "session",
            "verification",
            "api_key",
            "system_account",
            "workspace",
            "workspace_member",
            "workspace_invitation",
          ]
        : [
            "user",
            "account",
            "session",
            "verification",
            "api_key",
            "system_account",
          ]
    ).sort();
    const tables: { tablename: string }[] = await orm.em.execute(
      "select tablename from pg_tables where schemaname = ?",
      ["public"],
    );
    expect(tables.map((table) => table.tablename).sort()).toEqual(expected);
    const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
    const signup = await auth.api.signUpEmail({
      body: {
        name: "Alice",
        email: "alice@example.com",
        password: "valid-password",
      },
    });
    expect(signup.user.email).toBe("alice@example.com");
    const signin = await auth.api.signInEmail({
      body: { email: "alice@example.com", password: "valid-password" },
    });
    expect(signin.user.id).toBe(signup.user.id);
    expect(signin.token).toEqual(expect.any(String));
    const rawKey = "personal-key";
    const em = orm.em.fork();
    const key = em.create(ApiKey, {
      name: "Personal",
      key: createHash("sha256").update(rawKey).digest("base64url"),
      owner: em.getReference(User, signup.user.id),
    });
    em.persist(key);
    await em.flush();
    const authentication = app.get(ApiKeyAuthenticationService);
    await expect(authentication.validate(rawKey)).resolves.toMatchObject({
      ownerType: "user",
      user: { id: signup.user.id },
      apiKey: { id: key.id },
    });
    await expect(authentication.validate("missing-key")).rejects.toThrow(
      "Invalid API key",
    );
    expect(schema.getQueryType()?.getFields().currentUser).toBeDefined();
    expect(schema.getType("ApiKeyOwner")).toBeUndefined();
    expect(schema.getMutationType()?.getFields().signIn).toBeDefined();
    expect(
      schema.getMutationType()?.getFields().createUserApiKey,
    ).toBeDefined();
    for (const name of [
      "selectedWorkspace",
      "workspaceApiKeys",
      "currentWorkspaceMember",
      "workspaceRoles",
      "workspacePermissions",
      "workspaceApiKeyPermissions",
      "workspaceInvitation",
    ]) {
      expect(!!schema.getQueryType()?.getFields()[name]).toBe(enabled);
    }
    for (const name of [
      "createWorkspace",
      "addWorkspaceMember",
      "createWorkspaceInvitation",
      "createWorkspaceApiKey",
    ]) {
      expect(!!schema.getMutationType()?.getFields()[name]).toBe(enabled);
    }
    for (const name of [
      "Workspace",
      "WorkspaceMember",
      "WorkspaceInvitation",
      "WorkspaceRole",
      "WorkspacePermission",
    ]) {
      expect(!!schema.getType(name)).toBe(enabled);
    }
    const user = schema.getType("User") as GraphQLObjectType;
    expect(!!user.getFields().workspaces).toBe(enabled);
    expect(!!user.getFields().invitations).toBe(enabled);
    for (const service of [
      WorkspaceService,
      WorkspaceMemberService,
      WorkspaceInvitationService,
      WorkspaceApiKeyService,
    ]) {
      expect(!!app.get(service)).toBe(enabled);
    }
    const permissions = schema.getType("UserPermission") as GraphQLEnumType;
    expect(
      permissions.getValues().some(({ value }) => value === "workspace:create"),
    ).toBe(enabled);
  } finally {
    await app.close();
  }
}
