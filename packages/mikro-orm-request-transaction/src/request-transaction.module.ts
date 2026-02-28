import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  Optional,
} from "@nestjs/common";

import { RequestTransactionMiddleware } from "./request-transaction.middleware";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./request-transaction.module-definition";
import { RequestTransactionSubscriber } from "./request-transaction.subscriber";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

/**
 * Request-scoped database transaction module for MikroORM.
 *
 * @remarks
 * Automatically wraps each HTTP request in a database transaction via middleware,
 * committing on success and rolling back on failure.
 */
@Global()
@Module({
  imports: [RequestContextModule, MiddlewareModule],
  providers: [RequestTransactionSubscriber, RequestTransactionMiddleware],
})
export class RequestTransactionModule extends ConfigurableModuleClass {
  /**
   * Registers the RequestTransactionModule with the given options.
   * @param options - Configuration options including middleware settings
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the RequestTransactionModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /**
   * Creates a new RequestTransactionModule instance.
   * @param middlewareManager - Middleware manager for registering transaction middleware
   * @param requestTransactionMiddleware - The request transaction middleware instance
   * @param options - Optional transaction module configuration
   */
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
