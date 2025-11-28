import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { MiddlewareManager } from "./middleware.manager";

@Global()
@Module({
  providers: [MiddlewareManager],
  exports: [MiddlewareManager],
})
export class MiddlewareModule implements NestModule {
  constructor(private readonly middlewareManager: MiddlewareManager) {}

  configure(consumer: MiddlewareConsumer) {
    this.middlewareManager.configure(consumer);
  }
}
