import type { MikroORM } from "@mikro-orm/core";
import type { HashService } from "@nest-boot/hash";
import type { Mailer } from "@nest-boot/mailer";
import { RequestContext } from "@nest-boot/request-context";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

import { mikroOrmAdapter } from "../adapters/mikro-orm-adapter.js";
import { type AuthModuleOptions } from "../auth-module-options.interface.js";
import { authEntityMap } from "../entities/auth-entity-map.js";
import { User } from "../entities/user.entity.js";
import type { UserDeletionService } from "../services/user-deletion.service.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_ROLE,
} from "../user.constants.js";
import { resolveApiKeyPermissionCatalog } from "../utils/api-key-permissions.util.js";
import {
  assertAuthPermissionList,
  assertAuthPermissionSubset,
  assertAuthRolePermissions,
  assertAuthRolesExist,
} from "../utils/auth-role.util.js";
import { createEmailAndPasswordConfig } from "../utils/create-email-and-password-config.js";
import { createEmailVerificationConfig } from "../utils/create-email-verification-config.js";
import { createGenericOAuthConfig } from "../utils/create-generic-oauth-config.js";
import { createOidcConfig } from "../utils/create-oidc-config.js";
import { createSocialProvidersConfig } from "../utils/create-social-providers-config.js";
import { createUserConfig } from "../utils/create-user-config.js";
import { isEnvTrue } from "../utils/is-env-true.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { resolveSecret } from "../utils/resolve-secret.js";
import { runAuthQuery } from "../utils/run-auth-query.js";
import { splitAuthProviders } from "../utils/split-auth-providers.js";
import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_ROLE,
} from "../workspace.constants.js";
import { RequestIdentity } from "./request-identity.js";

/** Resolves framework configuration before constructing the upstream instance. @internal */
export function resolveBetterAuthOptions(
  options: AuthModuleOptions,
  orm: MikroORM,
  mailer: Mailer,
  hashService: HashService,
  userDeletionService: UserDeletionService,
): BetterAuthOptions {
  validateAuthOptions(options);
  const secret = resolveSecret(options);
  const disableSignUp = isEnvTrue("AUTH_DISABLE_SIGN_UP");
  const providers = splitAuthProviders(options.providers);
  const oidcConfig = createOidcConfig(disableSignUp);
  const genericOAuthConfig = createGenericOAuthConfig(
    disableSignUp,
    providers.genericOAuthProviders,
    oidcConfig,
  );
  const emailAndPasswordConfig = createEmailAndPasswordConfig(
    disableSignUp,
    mailer,
    hashService,
    options.emailAndPassword,
  );
  const emailVerificationConfig = createEmailVerificationConfig(
    mailer,
    options.emailVerification,
  );
  const socialProvidersConfig = createSocialProvidersConfig(
    disableSignUp,
    providers.socialProviders,
  );
  const userConfig = createUserConfig(
    mailer,
    options.user,
    async (userId, beforeDelete) => {
      await runAuthQuery(orm.em, () =>
        userDeletionService.deleteUser(userId, beforeDelete),
      );
      // Publish the committed deletion before Better Auth runs afterDelete.
      if (RequestContext.isActive() && RequestContext.get(User)?.id === userId)
        RequestIdentity.clear(orm.em);
    },
  );

  const betterAuthOptions: BetterAuthOptions = {
    appName: options.appName ?? process.env.APP_NAME,
    baseURL: options.baseURL ?? process.env.AUTH_URL ?? process.env.APP_URL,
    ...(options.account ? { account: options.account } : {}),
    secret,
    emailAndPassword: emailAndPasswordConfig,
    emailVerification: emailVerificationConfig,
    ...(userConfig ? { user: userConfig } : {}),
    ...(socialProvidersConfig
      ? { socialProviders: socialProvidersConfig }
      : {}),
    plugins: [
      ...(genericOAuthConfig.length > 0
        ? [
            genericOAuth({
              config: genericOAuthConfig,
            }),
          ]
        : []),
    ],
    database: mikroOrmAdapter({
      defaultUserRole: options.user?.defaultRole ?? DEFAULT_USER_ROLE,
      orm,
      entities: authEntityMap,
    }),
  };

  copyBetterAuthOptions(betterAuthOptions, options);
  return betterAuthOptions;
}

/** Constructs the single BetterAuth instance used by Nest providers. @internal */
export function createAuthInstance(
  options: AuthModuleOptions,
  orm: MikroORM,
  mailer: Mailer,
  hashService: HashService,
  userDeletionService: UserDeletionService,
): ReturnType<typeof betterAuth> {
  return betterAuth(
    resolveBetterAuthOptions(
      options,
      orm,
      mailer,
      hashService,
      userDeletionService,
    ),
  );
}

function validateAuthOptions(options: AuthModuleOptions): void {
  const { roles: userRoles, permissions: userPermissions } = resolveAuthCatalog(
    options,
    "user",
  );
  const { roles: workspaceRoles, permissions: workspacePermissions } =
    resolveAuthCatalog(options, "workspace");

  assertAuthRolePermissions(userRoles, userPermissions, "user");
  assertAuthRolePermissions(workspaceRoles, workspacePermissions, "workspace");
  if (
    options.apiKey &&
    ("defaultPermissions" in options.apiKey ||
      "allowedPermissions" in options.apiKey)
  ) {
    throw new Error(
      "Configure API key permissions under apiKey.user or apiKey.workspace",
    );
  }
  for (const scope of ["user", "workspace"] as const) {
    const { permissions: catalog, defaults } = resolveApiKeyPermissionCatalog(
      options,
      scope,
    );
    const configured = options.apiKey?.[scope];
    const allowed = configured?.allowedPermissions ?? catalog;
    assertAuthPermissionList(
      allowed,
      catalog,
      `apiKey.${scope}.allowedPermissions`,
    );
    assertAuthPermissionList(
      defaults,
      catalog,
      `apiKey.${scope}.defaultPermissions`,
    );
    assertAuthPermissionSubset(
      defaults,
      allowed,
      `apiKey.${scope}.defaultPermissions`,
      `apiKey.${scope}.allowedPermissions`,
    );
  }
  assertAuthRolesExist(
    userRoles,
    [options.user?.defaultRole ?? DEFAULT_USER_ROLE],
    "user.defaultRole",
  );
  assertAuthRolesExist(
    userRoles,
    options.user?.adminRoles ?? DEFAULT_USER_ADMIN_ROLES,
    "user.adminRoles",
  );
  assertAuthRolesExist(
    workspaceRoles,
    [options.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE],
    "workspace.defaultRole",
  );
  assertAuthRolesExist(
    workspaceRoles,
    [options.workspace?.creatorRole ?? DEFAULT_WORKSPACE_CREATOR_ROLE],
    "workspace.creatorRole",
  );
}

function copyBetterAuthOptions(
  target: BetterAuthOptions,
  source: AuthModuleOptions,
): void {
  if (source.basePath !== undefined) target.basePath = source.basePath;
  if (source.session !== undefined) target.session = source.session;
  if (source.trustedOrigins !== undefined) {
    target.trustedOrigins = source.trustedOrigins;
  }
}
