import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR, HttpAdapterHost } from "@nestjs/core";
import { Express } from "express";

import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContextMiddleware],
})
export class RequestContextModule implements NestModule {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly requestContextMiddleware: RequestContextMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }

  onModuleInit() {
    const httpAdapter = this.adapterHost.httpAdapter;

    if (httpAdapter) {
      const app = httpAdapter.getInstance<Express>();

      app.use(
        this.requestContextMiddleware.use.bind(this.requestContextMiddleware),
      );
    }
  }
}
