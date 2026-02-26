import { AuthMiddleware } from "@nest-boot/auth";
import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { RequestTransactionMiddleware } from "@nest-boot/mikro-orm-request-transaction";
import { Global, Inject, Module, Optional } from "@nestjs/common";

import { AuthRlsMiddleware } from "./auth-rls.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth-rls.module-definition";
import { AuthRlsService } from "./auth-rls.service";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

/**
 * Module for enabling Row Level Security (RLS) with Authentication.
 */
@Global()
@Module({
  imports: [MiddlewareModule],
  providers: [AuthRlsMiddleware, AuthRlsService],
  exports: [AuthRlsService],
})
export class AuthRlsModule extends ConfigurableModuleClass {
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
