# @nest-boot/redis

`RedisModule` provides the shared ioredis client. When `HealthCheckModule` is
imported in the same application, it automatically registers a `redis` indicator:

```ts
import { HealthCheckModule } from "@nest-boot/health-check";
import { RedisModule } from "@nest-boot/redis";
import { Module } from "@nestjs/common";

@Module({ imports: [HealthCheckModule, RedisModule] })
export class AppModule {}
```

The check uses the existing client, requires it to be ready, and expects `PING`
to return `PONG` within 1000 ms. Connection errors, unexpected replies, and timeouts
report `down`; the next health request checks again and can report recovery.
Reconnecting or lazily disconnected clients report `down` without queueing more
commands. Timeout does not close or reconfigure the application's connection.

Without `HealthCheckModule`, no check is registered or run. `RedisModule` does not
import it or create a health endpoint. The exported `RedisHealthIndicator` can
also be injected for explicit checks with `pingCheck(key, timeout)`.
