import type { MikroORM } from "@mikro-orm/core";
import type { HashService } from "@nest-boot/hash";
import type { Mailer } from "@nest-boot/mailer";
import { RequestContext } from "@nest-boot/request-context";
import type { ApplicationConfig } from "@nestjs/core";
import { betterAuth, type BetterAuthOptions, getBaseURL } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

import { resolveApiKeyPermissionCatalog } from "../api-key/utils/api-key-permissions.util.js";
import { resolveAuthCatalog } from "../common/utils/resolve-auth-catalog.util.js";
import { runAuthQuery } from "../common/utils/run-auth-query.js";
import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_ROLE,
} from "../workspace/constants/workspace.constants.js";
import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter.js";
import { AuthContext } from "./auth-context.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_ROLE,
} from "./constants/user.constants.js";
import {
  authEntityMap,
  workspaceEntityMap,
} from "./entities/auth-entity-map.js";
import { User } from "./entities/user.entity.js";
import { type AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import type { UserDeletionService } from "./services/user-deletion.service.js";
import {
  assertAuthPermissionList,
  assertAuthPermissionSubset,
  assertAuthRolePermissions,
  assertAuthRolesExist,
} from "./utils/auth-role.util.js";
import { createEmailAndPasswordConfig } from "./utils/create-email-and-password-config.js";
import { createEmailVerificationConfig } from "./utils/create-email-verification-config.js";
import { createGenericOAuthConfig } from "./utils/create-generic-oauth-config.js";
import { createOidcConfig } from "./utils/create-oidc-config.js";
import { createSocialProvidersConfig } from "./utils/create-social-providers-config.js";
import { createUserConfig } from "./utils/create-user-config.js";
import { isEnvTrue } from "./utils/is-env-true.js";
import { resolveAuthBasePath } from "./utils/resolve-auth-base-path.util.js";
import { resolveAuthFeatures } from "./utils/resolve-auth-features.util.js";
import { resolveSecret } from "./utils/resolve-secret.js";
import { splitAuthProviders } from "./utils/split-auth-providers.js";

/**
 * Resolves framework configuration before constructing the upstream instance.
 * @param options - Authentication module configuration.
 * @param orm - MikroORM instance used for persistence.
 * @param mailer - Mailer used to deliver authentication emails.
 * @param hashService - Service for hashing and verifying passwords.
 * @param userDeletionService - Service that deletes users and their related records.
 * @param authContext - Current request authentication context.
 * @returns Better Auth options assembled from the module configuration.
 * @internal
 */
export function resolveBetterAuthOptions(
  options: AuthModuleOptions,
  orm: MikroORM,
  mailer: Mailer,
  hashService: HashService,
  userDeletionService: UserDeletionService,
  authContext: AuthContext,
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
      if (
        RequestContext.isActive() &&
        RequestContext.get(User)?.id === userId
      ) {
        authContext.clear();
      }
    },
  );

  const baseURL =
    options.baseURL ?? process.env.AUTH_URL ?? process.env.APP_URL;
  const betterAuthOptions: BetterAuthOptions = {
    appName: options.appName ?? process.env.APP_NAME,
    // Resolve upstream URL environment fallbacks before validating the mount.
    // Use the root path here so the actual auth path is applied only at initialization.
    baseURL: (getBaseURL(baseURL, "/") ?? baseURL)?.replace(/\/+$/g, ""),
    basePath: resolveAuthBasePath(options.basePath),
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
      entities:
        options.workspace?.enabled === true
          ? { ...authEntityMap, ...workspaceEntityMap }
          : authEntityMap,
    }),
  };

  copyBetterAuthOptions(betterAuthOptions, options);
  return betterAuthOptions;
}

/**
 * Constructs the single BetterAuth instance used by Nest providers.
 * @param options - Authentication module configuration.
 * @param orm - MikroORM instance used for persistence.
 * @param mailer - Mailer used to deliver authentication emails.
 * @param hashService - Service for hashing and verifying passwords.
 * @param userDeletionService - Service that deletes users and their related records.
 * @param authContext - Current request authentication context.
 * @param applicationConfig - Host application's prefix, configured before initialization.
 * @returns Configured Better Auth instance.
 * @internal
 */
export function createAuthInstance(
  options: AuthModuleOptions,
  orm: MikroORM,
  mailer: Mailer,
  hashService: HashService,
  userDeletionService: UserDeletionService,
  authContext: AuthContext,
  applicationConfig?: ApplicationConfig,
): ReturnType<typeof betterAuth> {
  const config = resolveBetterAuthOptions(
    options,
    orm,
    mailer,
    hashService,
    userDeletionService,
    authContext,
  );
  // NestFactory.create() resolves providers before callers can setGlobalPrefix().
  // Reconcile early service reads with the final mount at app.init(). Afterwards
  // the mount is fixed, just like Nest's registered middleware routes.
  let instance: ReturnType<typeof betterAuth> | undefined;
  let instanceBasePath: string | undefined;
  let initializedBasePath: string | undefined;
  const getInstance = () => {
    const basePath =
      initializedBasePath ??
      resolveAuthBasePath(options.basePath, applicationConfig);
    if (!instance || instanceBasePath !== basePath) {
      instance = betterAuth<BetterAuthOptions>({ ...config, basePath });
      instanceBasePath = basePath;
    }
    return instance;
  };
  if (!applicationConfig) {
    assertAuthBaseURL(config.baseURL, resolveAuthBasePath(options.basePath));
    return getInstance();
  }
  const handler: ReturnType<typeof betterAuth>["handler"] = (request) =>
    getInstance().handler(request);
  const deferred = {
    handler,
    fetch: handler,
    get api() {
      return getInstance().api;
    },
    get options() {
      return getInstance().options;
    },
    get $context() {
      return getInstance().$context;
    },
    get $ERROR_CODES() {
      return getInstance().$ERROR_CODES;
    },
    get $Infer() {
      return getInstance().$Infer;
    },
    async onModuleInit() {
      initializedBasePath ??= resolveAuthBasePath(
        options.basePath,
        applicationConfig,
      );
      assertAuthBaseURL(config.baseURL, initializedBasePath);
      await getInstance().$context;
    },
  };
  return deferred;
}

/**
 * Rejects public URLs whose pathname would override the middleware mount.
 * @param baseURL - Configured public URL from options or the environment
 * @param basePath - Effective authentication mount
 */
function assertAuthBaseURL(
  baseURL: BetterAuthOptions["baseURL"],
  basePath: string,
): void {
  if (typeof baseURL !== "string" || !baseURL) {
    return;
  }
  const pathname = new URL(baseURL).pathname.replace(/\/+$/g, "");
  if (pathname && pathname !== basePath) {
    throw new Error(
      `Auth baseURL pathname must match the effective basePath (${basePath}). Configure baseURL, AUTH_URL, or APP_URL with the public origin or matching auth path.`,
    );
  }
}

/**
 * Validates authentication options before constructing Better Auth.
 * @param options - Authentication module configuration.
 */
function validateAuthOptions(options: AuthModuleOptions): void {
  const features = resolveAuthFeatures(options);
  const { roles: userRoles, permissions: userPermissions } = resolveAuthCatalog(
    options,
    "user",
  );
  const { roles: workspaceRoles, permissions: workspacePermissions } =
    resolveAuthCatalog(options, "workspace");

  assertAuthRolePermissions(userRoles, userPermissions, "user");
  if (options.workspace?.enabled === true) {
    assertAuthRolePermissions(
      workspaceRoles,
      workspacePermissions,
      "workspace",
    );
  }
  if (
    options.apiKey?.enabled === true &&
    options.apiKey.workspace?.enabled === true &&
    !features.workspace
  ) {
    throw new Error("apiKey.workspace requires workspace.enabled: true");
  }
  if (
    options.apiKey &&
    ("defaultPermissions" in options.apiKey ||
      "allowedPermissions" in options.apiKey)
  ) {
    throw new Error(
      "Configure API key permissions under apiKey.user or apiKey.workspace",
    );
  }
  if (options.apiKey && "member" in options.apiKey) {
    throw new Error("apiKey.member has been removed; use apiKey.workspace");
  }
  if (options.apiKey && "systemAccount" in options.apiKey) {
    throw new Error("apiKey.systemAccount has been removed; use apiKey.system");
  }
  for (const scope of ["user", "member", "systemAccount"] as const) {
    const scopeName =
      scope === "member"
        ? "workspace"
        : scope === "systemAccount"
          ? "system"
          : scope;
    const active =
      scope === "user"
        ? features.userApiKey
        : scope === "member"
          ? features.workspaceApiKey
          : features.systemApiKey;
    if (!active) {
      continue;
    }
    const { permissions: catalog, defaults } = resolveApiKeyPermissionCatalog(
      options,
      scope,
    );
    const configured = options.apiKey?.[scopeName];
    const allowed = configured?.allowedPermissions ?? catalog;
    assertAuthPermissionList(
      allowed,
      catalog,
      `apiKey.${scopeName}.allowedPermissions`,
    );
    assertAuthPermissionList(
      defaults,
      catalog,
      `apiKey.${scopeName}.defaultPermissions`,
    );
    assertAuthPermissionSubset(
      defaults,
      allowed,
      `apiKey.${scopeName}.defaultPermissions`,
      `apiKey.${scopeName}.allowedPermissions`,
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
  if (options.workspace?.enabled !== true) {
    return;
  }
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

/**
 * Copies supported module options into the Better Auth configuration.
 * @param target - Object that receives the configuration.
 * @param source - Source value to read from.
 */
function copyBetterAuthOptions(
  target: BetterAuthOptions,
  source: AuthModuleOptions,
): void {
  if (source.session !== undefined) {
    target.session = source.session;
  }
  if (source.trustedOrigins !== undefined) {
    target.trustedOrigins = source.trustedOrigins;
  }
}
