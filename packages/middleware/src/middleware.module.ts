import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { MiddlewareManager } from "./middleware.manager";

/**
 * Global module that provides the {@link MiddlewareManager} for registering
 * and configuring middleware with dependency ordering support.
 */
@Global()
@Module({
  providers: [MiddlewareManager],
  exports: [MiddlewareManager],
})
export class MiddlewareModule implements NestModule {
  /** Creates a new MiddlewareModule instance.
   * @param middlewareManager - The middleware manager instance
   */
  constructor(private readonly middlewareManager: MiddlewareManager) {}

  /** Configures all registered middlewares through the NestJS middleware consumer. */
  configure(consumer: MiddlewareConsumer) {
    this.middlewareManager.configure(consumer);
  }
}
