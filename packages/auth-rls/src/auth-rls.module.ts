import { AuthMiddleware } from "@nest-boot/auth";
import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { RequestTransactionMiddleware } from "@nest-boot/mikro-orm-request-transaction";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  Optional,
} from "@nestjs/common";

import { AuthRlsMiddleware } from "./auth-rls.middleware";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./auth-rls.module-definition";
import { AuthRlsService } from "./auth-rls.service";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

/**
 * Row-Level Security (RLS) module for authentication.
 *
 * @remarks
 * Integrates with the auth module to enforce row-level security policies
 * via PostgreSQL RLS, automatically applying security context through middleware.
 */
@Global()
@Module({
  imports: [MiddlewareModule],
  providers: [AuthRlsMiddleware, AuthRlsService],
  exports: [AuthRlsService],
})
export class AuthRlsModule extends ConfigurableModuleClass {
  /**
   * Registers the AuthRlsModule with the given options.
   * @param options - Configuration options including middleware settings
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the AuthRlsModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /**
   * Creates a new AuthRlsModule instance.
   * @param middlewareManager - Middleware manager for registering RLS middleware
   * @param authRlsMiddleware - The RLS middleware instance
   * @param options - Optional RLS module configuration
   */
  constructor(
    private readonly middlewareManager: MiddlewareManager,

    private readonly authRlsMiddleware: AuthRlsMiddleware,

    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: AuthRlsModuleOptions,
  ) {
    super();

    if (this.options?.middleware?.register !== false) {
      const proxy = this.middlewareManager
        .apply(this.authRlsMiddleware)
        .dependencies(AuthMiddleware, RequestTransactionMiddleware);

      if (this.options?.middleware?.excludeRoutes) {
        proxy.exclude(...this.options.middleware.excludeRoutes);
      }

      if (this.options?.middleware?.includeRoutes) {
        proxy.forRoutes(...this.options.middleware.includeRoutes);
      } else {
        proxy.forRoutes("*");
      }
    }
  }
}
