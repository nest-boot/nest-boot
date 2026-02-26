import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { MiddlewareManager } from "./middleware.manager";

/**
 * Module for dynamic middleware management.
 * It allows registering middlewares with dependencies and dynamic configuration.
 */
@Global()
@Module({
  providers: [MiddlewareManager],
  exports: [MiddlewareManager],
})
export class MiddlewareModule implements NestModule {
  constructor(private readonly middlewareManager: MiddlewareManager) {}

  /**
   * Configures the middleware consumer using the MiddlewareManager.
   */
  configure(consumer: MiddlewareConsumer) {
    this.middlewareManager.configure(consumer);
  }
}
