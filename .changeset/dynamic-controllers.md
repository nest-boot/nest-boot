---
"@nest-boot/common": patch
"@nest-boot/jwt": patch
"@nest-boot/health-check": minor
"@nest-boot/metrics": minor
"@nest-boot/mastra": minor
---

Migrate `@nest-boot/health-check`, `@nest-boot/metrics`, and `@nest-boot/mastra` HTTP endpoints to dynamic controllers powered by `@nest-boot/common`, and support zero-config module imports across global infrastructure modules:

- `@nest-boot/health-check`: Replace `HealthCheckMiddleware` and the `@nest-boot/middleware` dependency with a `VERSION_NEUTRAL` dynamic `HealthCheckController` defaulting to `path: "/health"` and `decorators: [Public()]`, and add `HealthCheckModule.forRoot` / `forRootAsync` while preserving direct `HealthCheckModule` imports.
- `@nest-boot/metrics`: Switch `MetricsModule` to `forRoot` / `forRootAsync` (preserving direct `MetricsModule` imports) and convert `MetricsController` to a `VERSION_NEUTRAL` dynamic controller supporting `path` (default `"/metrics"`) and `decorators` (default `[]`, without `@Public()`).
- `@nest-boot/mastra`: Default `MastraModule` to headless mode (`server` disabled unless `server: true` or `server: { ... }` is configured), replace the `RouterModule` metadata binding with `createDynamicController`, rename the top-level `api` option (`MastraApiOptions` / `normalizeMastraApiOptions` / `resolveMastraApiPrefix` / `DEFAULT_MASTRA_API_PREFIX`) to `server` (`MastraServerOptions` / `normalizeMastraServerOptions` / `resolveMastraServerPrefix` / `DEFAULT_MASTRA_SERVER_PREFIX`), add `server.decorators` defaulting to `[Can("manage", Mastra)]`, and mark `MastraController` `VERSION_NEUTRAL`.
- `@nest-boot/jwt`: Support zero-config direct `JwtModule` imports using environment-backed defaults (`JWT_SECRET ?? APP_SECRET` and `AUTH_URL ?? APP_URL`) and the default public `/.well-known/jwks.json` controller.
- `@nest-boot/common`: Support `enabled?: boolean` on `DynamicControllerOptions` to skip mounting disabled dynamic controllers, generate a per-container runtime controller subclass during module initialization so base/caller metadata and concurrent applications remain isolated, and raise minimum `@nestjs/common` / `@nestjs/core` peer dependencies across the updated packages to `^12.6.0`.
