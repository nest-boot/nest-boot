import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";

import { MikroOrmModule } from "@mikro-orm/nestjs";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./auth.module-definition";
import { AuthMiddleware } from "./middlewares";
import { AuthModuleOptions } from "./interfaces/auth-module-options.interface";

@Module({})
export class AuthModule extends ConfigurableModuleClass {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions = {}
  ) {
    super();
  }

  static register(options?: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(typeof options !== "undefined" ? options : {});
  }

  // configure(consumer: MiddlewareConsumer): void {
  //   const middlewareConfigProxy = consumer.apply(AuthMiddleware);
  //
  //   if (typeof this.options.excludeRoutes !== "undefined") {
  //     middlewareConfigProxy.exclude(...typeof this.options.excludeRoutes);
  //   }
  //
  //   if (typeof this.options.includeRoutes !== "undefined") {
  //     middlewareConfigProxy.forRoutes(...typeof this.options.includeRoutes);
  //   } else {
  //     middlewareConfigProxy.forRoutes("*");
  //   }
  // }
}
