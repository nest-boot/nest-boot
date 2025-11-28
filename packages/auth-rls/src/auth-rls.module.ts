import { AuthMiddleware } from "@nest-boot/auth";
import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Inject, Module, Optional } from "@nestjs/common";

import { AuthRlsMiddleware } from "./auth-rls.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth-rls.module-definition";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

@Global()
@Module({
  imports: [MiddlewareModule],
  providers: [AuthRlsMiddleware],
  exports: [AuthRlsMiddleware],
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
        .dependencies(AuthMiddleware);

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
