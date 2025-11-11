import { RequestContextModule } from "@nest-boot/request-context";
import {
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  Optional,
} from "@nestjs/common";

import { RequestTransactionMiddleware } from "./request-transaction.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./request-transaction.module-definition";
import { RequestTransactionSubscriber } from "./request-transaction.subscriber";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [RequestTransactionSubscriber, RequestTransactionMiddleware],
  exports: [RequestTransactionMiddleware],
})
export class RequestTransactionModule
  extends ConfigurableModuleClass
  implements NestModule
{
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: RequestTransactionModuleOptions,
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    if (this.options?.middleware?.register !== false) {
      const proxy = consumer.apply(RequestTransactionMiddleware);

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
