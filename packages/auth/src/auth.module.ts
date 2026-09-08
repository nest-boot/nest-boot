import { MikroORM } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import {
  type MiddlewareConfigurator,
  MiddlewareManager,
  MiddlewareModule,
} from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type ConfigurableModuleAsyncOptions,
  type DynamicModule,
  type FactoryProvider,
  Global,
  Inject,
  Module,
  type NestMiddleware,
  type Provider,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";

import { AccessControlService } from "./access-control.service.js";
import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter.js";
import { ApiKeyService } from "./api-key.service.js";
import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition.js";
import { AuthService } from "./auth.service.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { type AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseUser, BaseWorkspace } from "./entities/index.js";
import { configureAuthRelationTargets } from "./entities/resolve-auth-relation-target.js";
import { SessionService } from "./session.service.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import { UserService } from "./user.service.js";
import {
  UserDeletionService,
  WorkspaceOwnershipConflictError,
} from "./user-deletion.service.js";
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
import { resolveSecret } from "./utils/resolve-secret.js";
import { splitAuthProviders } from "./utils/split-auth-providers.js";
import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";
import { WorkspaceService } from "./workspace.service.js";

function configureRelationTargets(options: AuthModuleOptions): void {
  configureAuthRelationTargets([
    [BaseUser, options.entities.user],
    [BaseWorkspace, options.entities.workspace],
  ]);
}

function isAuthOptionsFactoryProvider(
  provider: Provider,
): provider is FactoryProvider<AuthModuleOptions> {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "provide" in provider &&
    provider.provide === MODULE_OPTIONS_TOKEN &&
    "useFactory" in provider &&
    typeof provider.useFactory === "function"
  );
}

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
    UserService,
    ApiKeyService,
    ApiKeyUsageInterceptor,
    AuthService,
    AccessControlService,
    SessionService,
    UserDeletionService,
    AuthGuard,
    AuthHandlerMiddleware,
    AuthMiddleware,
    WorkspaceService,
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
        const userRoles = options.user?.roles ?? DEFAULT_USER_ROLES;
        const workspaceRoles =
          options.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES;
        const userPermissions =
          options.user?.permissions ?? DEFAULT_USER_PERMISSIONS;
        const workspacePermissions =
          options.workspace?.permissions ?? DEFAULT_WORKSPACE_PERMISSIONS;
        const apiKeyPermissionCatalog = [
          ...new Set([...userPermissions, ...workspacePermissions]),
        ];
        const allowedApiKeyPermissions =
          options.apiKey?.allowedPermissions ?? apiKeyPermissionCatalog;
        const defaultApiKeyPermissions =
          options.apiKey?.defaultPermissions ?? [];

        assertAuthRolePermissions(userRoles, userPermissions, "user");
        assertAuthRolePermissions(
          workspaceRoles,
          workspacePermissions,
          "workspace",
        );
        assertAuthPermissionList(
          allowedApiKeyPermissions,
          apiKeyPermissionCatalog,
          "apiKey.allowedPermissions",
        );
        assertAuthPermissionList(
          defaultApiKeyPermissions,
          workspacePermissions,
          "apiKey.defaultPermissions",
        );
        assertAuthPermissionSubset(
          defaultApiKeyPermissions,
          allowedApiKeyPermissions,
          "apiKey.defaultPermissions",
        );
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
            try {
              await userDeletionService.deleteUser(userId, beforeDelete);
            } catch (error) {
              if (error instanceof WorkspaceOwnershipConflictError) {
                throw new APIError("CONFLICT", { message: error.message });
              }
              throw error;
            }
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
            entities: options.entities,
          }),
        };

        copyBetterAuthOptions(betterAuthOptions, options);
        return betterAuth(betterAuthOptions);
      },
    },
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    UserService,
    ApiKeyService,
    AuthGuard,
    AuthService,
    AccessControlService,
    SessionService,
    WorkspaceService,
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
    User extends BaseUser = BaseUser,
    Workspace extends BaseWorkspace = BaseWorkspace,
  >(
    options: AuthModuleOptions<
      UserPermission,
      WorkspacePermission,
      User,
      Workspace
    >,
  ): DynamicModule {
    configureRelationTargets(options as unknown as AuthModuleOptions);
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
    User extends BaseUser = BaseUser,
    Workspace extends BaseWorkspace = BaseWorkspace,
  >(
    options: ConfigurableModuleAsyncOptions<
      AuthModuleOptions<UserPermission, WorkspacePermission, User, Workspace>
    >,
  ): DynamicModule {
    const dynamicModule = super.forRootAsync(
      options as unknown as ConfigurableModuleAsyncOptions<AuthModuleOptions>,
    );

    return {
      ...dynamicModule,
      providers: dynamicModule.providers?.map((provider) => {
        if (!isAuthOptionsFactoryProvider(provider)) return provider;

        const useFactory = provider.useFactory;
        return {
          ...provider,
          useFactory: async (...args: Parameters<typeof useFactory>) => {
            const resolvedOptions = await useFactory(...args);
            configureRelationTargets(resolvedOptions);
            return resolvedOptions;
          },
        } satisfies FactoryProvider<AuthModuleOptions>;
      }),
    };
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
