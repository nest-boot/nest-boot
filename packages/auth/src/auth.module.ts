import { MikroORM } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import {
  type MiddlewareConfigurator,
  MiddlewareManager,
  MiddlewareModule,
} from "@nest-boot/middleware";
import {
  RequestContext,
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type ConfigurableModuleAsyncOptions,
  type DynamicModule,
  Global,
  Inject,
  Module,
  type NestMiddleware,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter.js";
import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { type AuthModuleOptions } from "./auth-module-options.interface.js";
import { authEntityMap } from "./entities/auth-entity-map.js";
import { User } from "./entities/user.entity.js";
import { InvitationResolver } from "./features/invitations/invitation.resolver.js";
import { InvitationService } from "./features/invitations/invitation.service.js";
import { AuthEnumRegistry } from "./infrastructure/auth-enum-registry.js";
import { authServiceProviders } from "./infrastructure/auth-service.providers.js";
import { RequestIdentity } from "./infrastructure/request-identity.js";
import { AuthResolver } from "./resolvers/auth.resolver.js";
import { MemberResolver } from "./resolvers/member.resolver.js";
import { SessionResolver } from "./resolvers/session.resolver.js";
import { UserResolver } from "./resolvers/user.resolver.js";
import { UserApiKeyResolver } from "./resolvers/user-api-key.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";
import { WorkspaceApiKeyResolver } from "./resolvers/workspace-api-key.resolver.js";
import { AccountService } from "./services/account.service.js";
import { AuthService } from "./services/auth.service.js";
import { MemberService } from "./services/member.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { UserDeletionService } from "./services/user-deletion.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { WorkspaceApiKeyService } from "./services/workspace-api-key.service.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import { resolveApiKeyPermissionCatalog } from "./utils/api-key-permissions.util.js";
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
import { resolveAuthCatalog } from "./utils/resolve-auth-catalog.util.js";
import { resolveSecret } from "./utils/resolve-secret.js";
import { runAuthQuery } from "./utils/run-auth-query.js";
import { splitAuthProviders } from "./utils/split-auth-providers.js";
import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

/**
 * Authentication module based on better-auth.
 *
 * @remarks
 * Provides authentication services including session management, middleware registration,
 * and MikroORM-based persistence via the better-auth adapter.
 */
@Global()
@Module({
  imports: [RequestContextModule, MiddlewareModule],
  providers: [
    {
      provide: AuthEnumRegistry,
      inject: [MODULE_OPTIONS_TOKEN, AUTH_TOKEN],
      useFactory: (options: AuthModuleOptions) => new AuthEnumRegistry(options),
    },
    AuthResolver,
    UserResolver,
    SessionResolver,
    UserApiKeyResolver,
    WorkspaceApiKeyResolver,
    WorkspaceResolver,
    MemberResolver,
    InvitationResolver,
    ...authServiceProviders,
    UserApiKeyService,
    WorkspaceApiKeyService,
    AccountService,
    ApiKeyUsageInterceptor,
    AuthService,
    UserDeletionService,
    AuthGuard,
    AuthHandlerMiddleware,
    AuthMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useExisting: ApiKeyUsageInterceptor,
    },
    {
      provide: AUTH_TOKEN,
      inject: [
        MODULE_OPTIONS_TOKEN,
        MikroORM,
        Mailer,
        HashService,
        UserDeletionService,
      ],
      useFactory: (
        options: AuthModuleOptions,
        orm: MikroORM,
        mailer: Mailer,
        hashService: HashService,
        userDeletionService: UserDeletionService,
      ) => {
        const { roles: userRoles, permissions: userPermissions } =
          resolveAuthCatalog(options, "user");
        const { roles: workspaceRoles, permissions: workspacePermissions } =
          resolveAuthCatalog(options, "workspace");

        assertAuthRolePermissions(userRoles, userPermissions, "user");
        assertAuthRolePermissions(
          workspaceRoles,
          workspacePermissions,
          "workspace",
        );
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
          const { permissions: catalog, defaults } =
            resolveApiKeyPermissionCatalog(options, scope);
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
            )
              RequestIdentity.clear(orm.em);
          },
        );

        const betterAuthOptions: BetterAuthOptions = {
          appName: options.appName ?? process.env.APP_NAME,
          baseURL:
            options.baseURL ?? process.env.AUTH_URL ?? process.env.APP_URL,
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
        return betterAuth(betterAuthOptions);
      },
    },
  ],
  exports: [
    AccountService,
    MODULE_OPTIONS_TOKEN,
    UserService,
    UserApiKeyService,
    WorkspaceApiKeyService,
    AuthGuard,
    AuthService,
    SessionService,
    WorkspaceService,
    MemberService,
    InvitationService,
  ],
})
export class AuthModule extends ConfigurableModuleClass {
  /**
   * Registers the AuthModule with the given options.
   * @param options - Configuration options including secret and middleware settings
   * @returns Dynamic module configuration
   */
  static override forRoot<
    const UserPermission extends string =
      (typeof DEFAULT_USER_PERMISSIONS)[number],
    const WorkspacePermission extends string =
      (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number],
    const UserRole extends string = keyof typeof DEFAULT_USER_ROLES,
    const WorkspaceRole extends string = keyof typeof DEFAULT_WORKSPACE_ROLES,
  >(
    options: AuthModuleOptions<
      UserPermission,
      WorkspacePermission,
      UserRole,
      WorkspaceRole
    >,
  ): DynamicModule {
    return super.forRoot(options as unknown as AuthModuleOptions);
  }

  /**
   * Registers the AuthModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync<
    const UserPermission extends string =
      (typeof DEFAULT_USER_PERMISSIONS)[number],
    const WorkspacePermission extends string =
      (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number],
    const UserRole extends string = keyof typeof DEFAULT_USER_ROLES,
    const WorkspaceRole extends string = keyof typeof DEFAULT_WORKSPACE_ROLES,
  >(
    options: ConfigurableModuleAsyncOptions<
      AuthModuleOptions<
        UserPermission,
        WorkspacePermission,
        UserRole,
        WorkspaceRole
      >
    >,
  ): DynamicModule {
    return super.forRootAsync(
      options as unknown as ConfigurableModuleAsyncOptions<AuthModuleOptions>,
    );
  }

  /**
   * Creates a new AuthModule instance.
   * @param options - Auth module configuration options
   * @param middlewareManager - Middleware manager for registering auth middleware
   * @param authHandlerMiddleware - The dependency-injected auth endpoint handler
   * @param authMiddleware - The auth middleware instance
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly middlewareManager: MiddlewareManager,
    @Inject(AuthHandlerMiddleware)
    private readonly authHandlerMiddleware: NestMiddleware,
    private readonly authMiddleware: AuthMiddleware,
  ) {
    super();

    const basePath = this.options.basePath ?? "/api/auth/";

    this.middlewareManager.globalExclude(basePath);

    this.middlewareManager
      .apply(this.authHandlerMiddleware)
      .disableGlobalExcludeRoutes()
      .forRoutes(basePath);

    if (this.options.middleware?.register !== false) {
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.authMiddleware)
          .dependencies(RequestContextMiddleware),
      );
    }
  }

  private configureRequestMiddleware(proxy: MiddlewareConfigurator): void {
    if (this.options.middleware?.excludeRoutes) {
      proxy.exclude(...this.options.middleware.excludeRoutes);
    }

    proxy.forRoutes(...(this.options.middleware?.includeRoutes ?? ["*"]));
  }
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
