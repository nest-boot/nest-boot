import {
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  Optional,
} from "@nestjs/common";

import { AuthRlsMiddleware } from "./auth-rls.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth-rls.module-definition";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

@Global()
@Module({
  providers: [AuthRlsMiddleware],
  exports: [AuthRlsMiddleware],
})
export class AuthRlsModule
  extends ConfigurableModuleClass
  implements NestModule
{
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: AuthRlsModuleOptions,
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    if (this.options?.middleware?.register !== false) {
      const proxy = consumer.apply(AuthRlsMiddleware);

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
