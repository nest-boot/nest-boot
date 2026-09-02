import { MikroORM } from "@mikro-orm/core";
import { CryptService } from "@nest-boot/crypt";
import {
  type MiddlewareConfigurator,
  MiddlewareManager,
  MiddlewareModule,
} from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import { type DynamicModule, Global, Inject, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { type Auth, betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { genericOAuth } from "better-auth/plugins";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter.js";
import { ApiKeyMiddleware } from "./api-key.middleware.js";
import { ApiKeyService } from "./api-key.service.js";
import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./auth.module-definition.js";
import { AuthService } from "./auth.service.js";
import { type AuthModuleOptions } from "./auth-module-options.interface.js";
import { assertNoDuplicateGenericOAuthPlugin } from "./utils/assert-no-duplicate-generic-oauth-plugin.js";
import { createEmailAndPasswordConfig } from "./utils/create-email-and-password-config.js";
import { createOidcConfig } from "./utils/create-oidc-config.js";
import { createSocialProvidersConfig } from "./utils/create-social-providers-config.js";
import { isEnvTrue } from "./utils/is-env-true.js";
import { resolveSecret } from "./utils/resolve-secret.js";
import { WorkspaceMiddleware } from "./workspace.middleware.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceMemberMiddleware } from "./workspace-member.middleware.js";

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
    ApiKeyMiddleware,
    ApiKeyService,
    ApiKeyUsageInterceptor,
    AuthService,
    AuthGuard,
    AuthMiddleware,
    WorkspaceMiddleware,
    WorkspaceMemberMiddleware,
    WorkspaceService,
    {
      provide: CryptService,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: AuthModuleOptions) =>
        new CryptService(resolveSecret(options)),
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: ApiKeyUsageInterceptor,
    },
    {
      provide: AUTH_TOKEN,
      inject: [MODULE_OPTIONS_TOKEN, MikroORM],
      useFactory: (options: AuthModuleOptions, orm: MikroORM) => {
        const betterAuthModuleOptions: Partial<AuthModuleOptions> = {
          ...options,
        };
        delete betterAuthModuleOptions.buildAbility;
        delete betterAuthModuleOptions.entities;
        delete betterAuthModuleOptions.middleware;
        delete betterAuthModuleOptions.onAuthenticated;
        const secret = resolveSecret(options);
        const disableSignUp = isEnvTrue("AUTH_DISABLE_SIGN_UP");
        const oidcConfig = createOidcConfig(disableSignUp);
        const {
          emailAndPassword,
          plugins,
          socialProviders,
          ...betterAuthOptions
        } = betterAuthModuleOptions;
        const emailAndPasswordConfig = createEmailAndPasswordConfig(
          disableSignUp,
          emailAndPassword,
        );
        const socialProvidersConfig = createSocialProvidersConfig(
          disableSignUp,
          socialProviders,
        );

        if (oidcConfig) {
          assertNoDuplicateGenericOAuthPlugin(plugins);
        }

        return betterAuth({
          appName: process.env.APP_NAME,
          baseURL: process.env.AUTH_URL ?? process.env.APP_URL,
          secret,
          account: {
            skipStateCookieCheck: true,
          },
          ...betterAuthOptions,
          emailAndPassword: emailAndPasswordConfig,
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
            ...(plugins ?? []),
          ],
          database: mikroOrmAdapter({
            orm,
            entities: options.entities,
          }),
        });
      },
    },
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    ApiKeyService,
    AuthGuard,
    AuthService,
    WorkspaceService,
  ],
})
export class AuthModule extends ConfigurableModuleClass {
  /**
   * Registers the AuthModule with the given options.
   * @param options - Configuration options including secret and middleware settings
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the AuthModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /**
   * Creates a new AuthModule instance.
   * @param auth - The better-auth instance
   * @param options - Auth module configuration options
   * @param middlewareManager - Middleware manager for registering auth middleware
   * @param authMiddleware - The auth middleware instance
   * @param workspaceMiddleware - The workspace selection middleware
   * @param apiKeyMiddleware - The API-key authentication middleware
   * @param workspaceMemberMiddleware - The workspace membership middleware
   */
  constructor(
    @Inject(AUTH_TOKEN)
    private readonly auth: Auth,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly middlewareManager: MiddlewareManager,
    private readonly authMiddleware: AuthMiddleware,
    private readonly workspaceMiddleware: WorkspaceMiddleware,
    private readonly apiKeyMiddleware: ApiKeyMiddleware,
    private readonly workspaceMemberMiddleware: WorkspaceMemberMiddleware,
  ) {
    super();

    const basePath = this.options.basePath ?? "/api/auth/";

    this.middlewareManager.globalExclude(basePath);

    this.middlewareManager
      .apply(toNodeHandler(this.auth))
      .disableGlobalExcludeRoutes()
      .forRoutes(basePath);

    if (this.options.middleware?.register !== false) {
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.workspaceMiddleware)
          .dependencies(RequestContextMiddleware)
          .before(AuthMiddleware),
      );
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.authMiddleware)
          .dependencies(RequestContextMiddleware)
          .after(WorkspaceMiddleware),
      );
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.apiKeyMiddleware)
          .after(AuthMiddleware, WorkspaceMiddleware),
      );
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.workspaceMemberMiddleware)
          .after(AuthMiddleware, ApiKeyMiddleware),
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
