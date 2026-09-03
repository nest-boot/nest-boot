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
  Global,
  Inject,
  Module,
  type NestMiddleware,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

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
import { SessionService } from "./session.service.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import { UserService } from "./user.service.js";
import { assertAuthRolePermissions } from "./utils/auth-role.util.js";
import { createEmailAndPasswordConfig } from "./utils/create-email-and-password-config.js";
import { createEmailVerificationConfig } from "./utils/create-email-verification-config.js";
import { createOidcConfig } from "./utils/create-oidc-config.js";
import { createSocialProvidersConfig } from "./utils/create-social-providers-config.js";
import { createUserConfig } from "./utils/create-user-config.js";
import { isEnvTrue } from "./utils/is-env-true.js";
import { resolveSecret } from "./utils/resolve-secret.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";
import { WorkspaceService } from "./workspace.service.js";

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
    SessionService,
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
      inject: [MODULE_OPTIONS_TOKEN, MikroORM, Mailer, HashService],
      useFactory: (
        options: AuthModuleOptions,
        orm: MikroORM,
        mailer: Mailer,
        hashService: HashService,
      ) => {
        assertAuthRolePermissions(
          options.user?.roles ?? DEFAULT_USER_ROLES,
          options.user?.permissions ?? DEFAULT_USER_PERMISSIONS,
          "user",
        );
        assertAuthRolePermissions(
          options.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES,
          options.workspace?.permissions ?? DEFAULT_WORKSPACE_PERMISSIONS,
          "workspace",
        );

        const secret = resolveSecret(options);
        const disableSignUp = isEnvTrue("AUTH_DISABLE_SIGN_UP");
        const oidcConfig = createOidcConfig(disableSignUp);
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
          options.socialProviders,
        );
        const userConfig = createUserConfig(mailer, options.user);

        const betterAuthOptions: BetterAuthOptions = {
          appName: options.appName ?? process.env.APP_NAME,
          baseURL:
            options.baseURL ?? process.env.AUTH_URL ?? process.env.APP_URL,
          secret,
          account: {
            skipStateCookieCheck: true,
            ...options.account,
          },
          emailAndPassword: emailAndPasswordConfig,
          emailVerification: emailVerificationConfig,
          ...(userConfig ? { user: userConfig } : {}),
          ...(socialProvidersConfig
            ? { socialProviders: socialProvidersConfig }
            : {}),
          plugins: [
            ...(oidcConfig
              ? [
                  genericOAuth({
                    config: [oidcConfig],
                  }),
                ]
              : []),
          ],
          database: mikroOrmAdapter({
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
  >(
    options: AuthModuleOptions<UserPermission, WorkspacePermission>,
  ): DynamicModule {
    return super.forRoot(options);
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
  >(
    options: ConfigurableModuleAsyncOptions<
      AuthModuleOptions<UserPermission, WorkspacePermission>
    >,
  ): DynamicModule {
    return super.forRootAsync(options);
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
  if (source.advanced !== undefined) target.advanced = source.advanced;
  if (source.basePath !== undefined) target.basePath = source.basePath;
  if (source.databaseHooks !== undefined) {
    target.databaseHooks = source.databaseHooks;
  }
  if (source.disabledPaths !== undefined) {
    target.disabledPaths = source.disabledPaths;
  }
  if (source.hooks !== undefined) target.hooks = source.hooks;
  if (source.logger !== undefined) target.logger = source.logger;
  if (source.onAPIError !== undefined) target.onAPIError = source.onAPIError;
  if (source.rateLimit !== undefined) target.rateLimit = source.rateLimit;
  if (source.secrets !== undefined) target.secrets = source.secrets;
  if (source.secondaryStorage !== undefined) {
    target.secondaryStorage = source.secondaryStorage;
  }
  if (source.session !== undefined) target.session = source.session;
  if (source.telemetry !== undefined) target.telemetry = source.telemetry;
  if (source.trustedOrigins !== undefined) {
    target.trustedOrigins = source.trustedOrigins;
  }
  if (source.verification !== undefined) {
    target.verification = source.verification;
  }
}
