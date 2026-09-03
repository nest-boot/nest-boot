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
  type DynamicModule,
  Global,
  Inject,
  Module,
  type NestMiddleware,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter.js";
import { AdminService } from "./admin.service.js";
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
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { type AuthModuleOptions } from "./auth-module-options.interface.js";
import { SessionService } from "./session.service.js";
import { createEmailAndPasswordConfig } from "./utils/create-email-and-password-config.js";
import { createEmailVerificationConfig } from "./utils/create-email-verification-config.js";
import { createOidcConfig } from "./utils/create-oidc-config.js";
import { createSocialProvidersConfig } from "./utils/create-social-providers-config.js";
import { createUserConfig } from "./utils/create-user-config.js";
import { isEnvTrue } from "./utils/is-env-true.js";
import { resolveSecret } from "./utils/resolve-secret.js";
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
    AdminService,
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
        const betterAuthModuleOptions: Partial<AuthModuleOptions> = {
          ...options,
        };
        delete betterAuthModuleOptions.buildWorkspaceAbility;
        delete betterAuthModuleOptions.buildUserAbility;
        delete betterAuthModuleOptions.entities;
        delete betterAuthModuleOptions.middleware;
        delete betterAuthModuleOptions.onAuthenticated;
        delete betterAuthModuleOptions.workspace;
        const secret = resolveSecret(options);
        const disableSignUp = isEnvTrue("AUTH_DISABLE_SIGN_UP");
        const oidcConfig = createOidcConfig(disableSignUp);
        const {
          account,
          emailAndPassword,
          emailVerification,
          socialProviders,
          user,
          ...betterAuthOptions
        } = betterAuthModuleOptions;
        const emailAndPasswordConfig = createEmailAndPasswordConfig(
          disableSignUp,
          mailer,
          hashService,
          emailAndPassword,
        );
        const emailVerificationConfig = createEmailVerificationConfig(
          mailer,
          emailVerification,
        );
        const socialProvidersConfig = createSocialProvidersConfig(
          disableSignUp,
          socialProviders,
        );
        const userConfig = createUserConfig(mailer, user);

        return betterAuth({
          appName: process.env.APP_NAME,
          baseURL: process.env.AUTH_URL ?? process.env.APP_URL,
          secret,
          account: {
            skipStateCookieCheck: true,
            ...account,
          },
          ...betterAuthOptions,
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
        });
      },
    },
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    AdminService,
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
