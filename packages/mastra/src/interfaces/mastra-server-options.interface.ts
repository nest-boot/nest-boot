import type { MastraModuleOptions as MastraCoreModuleOptions } from "@mastra/nestjs";

export type MastraServerModuleOptions = Omit<
  MastraCoreModuleOptions,
  "mastra" | "tools" | "auth" | "customRouteAuthConfig"
> & {
  /** Authentication belongs to NestJS guards and `@nest-boot/auth`. */
  auth?: never;
  /** Custom routes belong to NestJS controllers. */
  customRouteAuthConfig?: never;
  /** HTTP port belongs to the host NestJS application. */
  port?: never;
  /** HTTP host belongs to the host NestJS application. */
  host?: never;
  /** Custom Hono routes belong to NestJS controllers. */
  apiRoutes?: never;
  /** Hono middleware is unsupported; use NestJS middleware, guards, or interceptors. */
  middleware?: never;
  /** CORS belongs to the host NestJS application. */
  cors?: never;
  /** Use `server.prefix` instead of `@mastra/core`'s `apiPrefix`. */
  apiPrefix?: never;
};

export interface MastraServerOptions extends MastraServerModuleOptions {
  /** Whether to register the Mastra HTTP server controller and middleware (default: `true` when `server` object is provided). */
  enabled?: boolean;

  /**
   * Class decorators applied to the Mastra HTTP controller, defaulting to `[Can("manage", Mastra)]`.
   *
   * Supports both metadata decorators (such as `Can()`, `Public()`, or `SkipThrottle()`) and
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`).
   */
  decorators?: ClassDecorator[];
}
