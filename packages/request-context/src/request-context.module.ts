import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Inject, Module, OnModuleInit, Optional } from "@nestjs/common";
import {
  APP_INTERCEPTOR,
  DiscoveryService,
  MetadataScanner,
} from "@nestjs/core";

import { CreateRequestContext } from "./create-request-context.decorator";
import { RequestContext } from "./request-context";
import { CREATE_REQUEST_CONTEXT_METADATA } from "./request-context.constants";
import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

/**
 * Module that provides request context management using AsyncLocalStorage.
 * It allows storing and retrieving data scoped to the current execution context (request, job, etc.).
 */
@Global()
@Module({
  imports: [MiddlewareModule, DiscoveryService],
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContextMiddleware],
})
export class RequestContextModule implements OnModuleInit {
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly requestContextMiddleware: RequestContextMiddleware,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  onModuleInit() {
    this.middlewareManager
      .apply(this.requestContextMiddleware)
      .forRoutes("*")
      .disableGlobalExcludeRoutes();

    this.discoveryService
      .getProviders()
      .concat(this.discoveryService.getControllers())
      .forEach((instanceWrapper) => {
        const { instance } = instanceWrapper;
        if (!instance || typeof instance !== "object") {
          return;
        }

        const prototype = Object.getPrototypeOf(instance);
        this.metadataScanner.getAllMethodNames(prototype).forEach((method) => {
          const createRequestContextOptions = Reflect.getMetadata(
            CREATE_REQUEST_CONTEXT_METADATA,
            instance[method],
          );

          if (createRequestContextOptions) {
            const originalMethod = instance[method];

            instance[method] = async function (...args: any[]) {
              const ctx = new RequestContext({
                type: createRequestContextOptions.type,
              });
              return await RequestContext.run(ctx, () =>
                originalMethod.apply(this, args),
              );
            };

            // Copy metadata from original method to wrapped method
            Reflect.getMetadataKeys(originalMethod).forEach((key) => {
              const value = Reflect.getMetadata(key, originalMethod);
              Reflect.defineMetadata(key, value, instance[method]);
            });
          }
        });
      });
  }
}
