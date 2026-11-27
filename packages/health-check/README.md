# @nest-boot/health-check

Shared health check indicator registration and Terminus execution for Nest Boot on NestJS 12 and Terminus 12. Application and infrastructure modules register indicators into `HealthCheckRegistry`, and a built-in dynamic controller exposes `GET /health` marked with `@Public()` and `VERSION_NEUTRAL` by default.

Import `HealthCheckModule` once in the application root for default settings, or use `HealthCheckModule.forRoot` / `HealthCheckModule.forRootAsync` to customize `path` and `decorators`:

```ts
import { HealthCheckModule } from "@nest-boot/health-check";
import { Module } from "@nestjs/common";

@Module({ imports: [HealthCheckModule] })
export class AppModule {}
```

```ts
HealthCheckModule.forRoot({
  path: "/readyz",
  decorators: [UseGuards(InternalProbeGuard)],
});
```

Register functions through `HealthCheckRegistry.register(...indicators)`, usually in a feature provider's `onModuleInit`. Each function returns a Terminus health indicator result, synchronously or asynchronously. Registration appends to the existing list and does not execute the functions.

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

`GET /health` reads the current registry on every request and preserves Terminus's result and exceptions: healthy checks return HTTP 200, and unhealthy checks return HTTP 503. With no registered indicators, Terminus returns an empty healthy result. `HealthCheckService.check()` remains available for programmatic checks. Responses always include `Cache-Control: no-cache, no-store, must-revalidate`.

The endpoint follows Nest's global prefix configuration (`/health` without a global prefix, `/api/health` with `app.setGlobalPrefix("api")`) and declares `VERSION_NEUTRAL` so URI versioning does not prefix `/v1` onto the probe URL. To expose `/health` outside the global prefix, use Nest's standard exclusion:

```ts
import { RequestMethod } from "@nestjs/common";

app.setGlobalPrefix("api", {
  exclude: [{ path: "health", method: RequestMethod.GET }],
});
```

By default, `HealthCheckModule` applies `Public()` from `@nest-boot/common` so global `AuthGuard` setups allow unauthenticated health probes without depending on `@nest-boot/auth`. Pass `decorators` in `forRoot` or `forRootAsync` (including metadata decorators or DI-injected `@UseGuards`, `@UseInterceptors`, `@UsePipes`, and `@UseFilters`) to customize access control.

Infrastructure modules register their own checks when this module is imported: `DatabaseModule` registers `database` using `DatabaseHealthIndicator`, `RedisModule` registers `redis`, and `QueueModule` registers `queue.<name>` for each discovered queue. Without `HealthCheckModule`, these modules do not register automatic health checks.

## Package tests

Unit and HTTP tests exercise the compiled ESM entry so Nest constructor metadata and coverage describe the published code. Build the package before running tests directly.
