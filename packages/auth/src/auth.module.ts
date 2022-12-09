import {
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuthGuard } from "./auth.guard";
import { AuthMiddleware } from "./auth.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./interfaces";

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthService,
  ],
  exports: [AuthService],
})
export class AuthModule extends ConfigurableModuleClass implements NestModule {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer): void {
    const middlewareConfigProxy = consumer.apply(AuthMiddleware);

    if (typeof this.options.excludeRoutes !== "undefined") {
      middlewareConfigProxy.exclude(...this.options.excludeRoutes);
    }

    if (typeof this.options.includeRoutes !== "undefined") {
      middlewareConfigProxy.forRoutes(...this.options.includeRoutes);
    } else {
      middlewareConfigProxy.forRoutes("*");
    }
  }
}
