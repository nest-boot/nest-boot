# @nest-boot/health-check

Restores the original Nest Boot health check design on NestJS 12 and Terminus 12:
application modules register indicators, and one service executes all registered
checks through Terminus.

Import `HealthCheckModule` once in the application root. Its registry and check
service are global providers available to other application modules.

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

The application defines the route and its decorators:

```ts
import { HealthCheck, HealthCheckService } from "@nest-boot/health-check";
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check();
  }
}
```

Register the controller in an application module. `check()` reads the current
registry on every call and preserves Terminus's result and exceptions: healthy
checks return HTTP 200, and unhealthy checks return HTTP 503. With no registered
indicators, Terminus returns an empty healthy result.

As in the last version before removal, the module defines no controller. It does
not automatically register Redis or database checks, deduplicate registrations,
or add readiness/liveness groups, caching, or timeout configuration.

The package re-exports the health decorator, result types, and built-in indicators
from Terminus's public entry point. Terminus 12 removed the legacy
`HealthIndicator`, `HealthCheckError`, and `TimeoutError` APIs and restricts internal
package imports. The old `DatabaseNotConnectedError`, `checkPackages`,
`promiseTimeout`, and `PromiseTimeoutError` internal re-exports are therefore not
restored. Custom indicators can return health results directly or use Terminus's
`HealthIndicatorService`.
