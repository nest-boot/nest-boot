import { MikroORM } from "@mikro-orm/core";
import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import { type DynamicModule, Global, Inject, Module } from "@nestjs/common";
import { type Auth, betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { genericOAuth } from "better-auth/plugins";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter";
import { AUTH_TOKEN } from "./auth.constants";
import { AuthMiddleware } from "./auth.middleware";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./auth-module-options.interface";
import { assertNoDuplicateGenericOAuthPlugin } from "./utils/assert-no-duplicate-generic-oauth-plugin";
import { createEmailAndPasswordConfig } from "./utils/create-email-and-password-config";
import { createOidcConfig } from "./utils/create-oidc-config";
import { createSocialProvidersConfig } from "./utils/create-social-providers-config";
import { isEnvTrue } from "./utils/is-env-true";
import { resolveSecret } from "./utils/resolve-secret";

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
    AuthService,
    AuthMiddleware,
    {
      provide: AUTH_TOKEN,
      inject: [MODULE_OPTIONS_TOKEN, MikroORM],
      useFactory: (options: AuthModuleOptions, orm: MikroORM) => {
        const secret = resolveSecret(options);
        const disableSignUp = isEnvTrue("AUTH_DISABLE_SIGN_UP");
        const oidcConfig = createOidcConfig(disableSignUp);
        const {
          emailAndPassword,
          plugins,
          socialProviders,
          ...betterAuthOptions
        } = options;
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
  exports: [AuthService],
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
   */
  constructor(
    @Inject(AUTH_TOKEN)
    private readonly auth: Auth,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly middlewareManager: MiddlewareManager,
    private readonly authMiddleware: AuthMiddleware,
  ) {
    super();

    const basePath = this.options.basePath ?? "/api/auth/";

    this.middlewareManager.globalExclude(basePath);

    this.middlewareManager
      .apply(toNodeHandler(this.auth))
      .disableGlobalExcludeRoutes()
      .forRoutes(basePath);

    if (this.options.middleware?.register !== false) {
      const proxy = this.middlewareManager
        .apply(this.authMiddleware)
        .dependencies(RequestContextMiddleware);

      if (this.options.middleware?.excludeRoutes) {
        proxy.exclude(...this.options.middleware.excludeRoutes);
      }

      if (this.options.middleware?.includeRoutes) {
        proxy.forRoutes(...this.options.middleware.includeRoutes);
      } else {
        proxy.forRoutes("*");
      }
    }
  }
}
