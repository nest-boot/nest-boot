# @nest-boot/health-check

Restores the original Nest Boot health check design on NestJS 12 and Terminus 12:
application modules register indicators, and one service executes all registered
checks through Terminus. Built-in middleware exposes `GET /api/health`.

Import `HealthCheckModule` once in the application root. Its registry and check
service are global providers available to other application modules. Importing the
module also registers the health endpoint; no application controller is required.

```ts
import { HealthCheckModule } from "@nest-boot/health-check";
import { Module } from "@nestjs/common";

@Module({ imports: [HealthCheckModule] })
export class AppModule {}
```

Register functions through `HealthCheckRegistry.register(...indicators)`, usually
in a feature provider's `onModuleInit`. Each function returns a Terminus health
indicator result, synchronously or asynchronously. Registration appends to the
existing list and does not execute the functions.

```ts
import { HealthCheckRegistry } from "@nest-boot/health-check";
import { Injectable, type OnModuleInit } from "@nestjs/common";

@Injectable()
export class FeatureHealth implements OnModuleInit {
  private ready = false;

  constructor(private readonly registry: HealthCheckRegistry) {}

  onModuleInit(): void {
    this.ready = true;
    this.registry.register(() => ({
      feature: { status: this.ready ? "up" : "down" },
    }));
  }
}
```

Register the feature provider in its module. Indicators may instead call Terminus's
built-in checks; their providers are configured through `TerminusModule` in the
feature module as usual.

`GET /api/health` reads the current registry on every request and preserves
Terminus's result and exceptions: healthy checks return HTTP 200, and unhealthy
checks return HTTP 503. With no registered indicators, Terminus returns an empty
healthy result. `HealthCheckService.check()` remains available for programmatic
checks.

The middleware follows Nest's route prefix configuration. If your application
sets a global prefix, exclude this route to keep `/api/health` and
avoid an extra prefix (for example, `/api/api/health`):

```ts
import { RequestMethod } from "@nestjs/common";

app.setGlobalPrefix("api", {
  exclude: [{ path: "api/health", method: RequestMethod.GET }],
});
```

The health middleware ends the response before Nest's guards,
interceptors, pipes, and controller handling. Responses include
`Cache-Control: no-cache, no-store, must-revalidate`. Failed checks use Nest's
exception handling, preserving Terminus's 503 response; unexpected failures use
the application's global exception handling.

`HealthCheckModule` imports `@nest-boot/middleware` and registers the handler
through `MiddlewareManager`, following its normal ordering and route exclusions.
Earlier middleware, including auth middleware, still runs and must allow the
request to reach the health handler. Once reached, the handler responds without
entering `AuthGuard`, so no `@Public()` marker is required. The package does not
depend on `@nest-boot/auth`.

Infrastructure modules register their own checks when this module is imported:
`DatabaseModule` registers `database` using `DatabaseHealthIndicator`,
`RedisModule` registers `redis`, and `QueueModule` registers `queue.<name>` for
each discovered queue. They reuse their existing connections. Each automatic
probe has a 1,000 ms timeout and shares an unfinished database or Redis operation
across requests until it settles. Without `HealthCheckModule`, these modules do
not register automatic health checks.

The database indicator initializes its existing lazy connection during application
startup when health checks are enabled. Runtime probes report a closed connection
as unhealthy and do not initialize or reconnect it.

The health module itself does not deduplicate registrations or add
readiness/liveness groups, caching, or timeout configuration.

The package re-exports the health decorator, result types, and built-in indicators
from Terminus's public entry point. Terminus 12 removed the legacy
`HealthIndicator`, `HealthCheckError`, and `TimeoutError` APIs and restricts internal
package imports. The old `DatabaseNotConnectedError`, `checkPackages`,
`promiseTimeout`, and `PromiseTimeoutError` internal re-exports are therefore not
restored. Custom indicators can return health results directly or use Terminus's
`HealthIndicatorService`.

## Package tests

Unit and HTTP tests use the compiled ESM entry so Nest constructor metadata and
coverage describe the published code. Test commands build the package first.
When using `test:watch`, run `pnpm dev` in a second terminal to rebuild source
changes. Source maps keep both coverage reports associated with TypeScript files.
