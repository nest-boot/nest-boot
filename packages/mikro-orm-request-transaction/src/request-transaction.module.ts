import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Global, Inject, Module, Optional } from "@nestjs/common";

import { RequestTransactionMiddleware } from "./request-transaction.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./request-transaction.module-definition";
import { RequestTransactionSubscriber } from "./request-transaction.subscriber";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

@Global()
@Module({
  imports: [RequestContextModule, MiddlewareModule],
  providers: [RequestTransactionSubscriber, RequestTransactionMiddleware],
})
export class RequestTransactionModule extends ConfigurableModuleClass {
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly requestTransactionMiddleware: RequestTransactionMiddleware,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: RequestTransactionModuleOptions,
  ) {
    super();

    if (this.options?.middleware?.register !== false) {
      const proxy = this.middlewareManager
        .apply(this.requestTransactionMiddleware)
        .dependencies(RequestContextMiddleware);

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
