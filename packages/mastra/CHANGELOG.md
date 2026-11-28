# @nest-boot/mastra

## 8.2.0

### Minor Changes

- 97fad07: Migrate `@nest-boot/health-check`, `@nest-boot/metrics`, and `@nest-boot/mastra` HTTP endpoints to dynamic controllers powered by `@nest-boot/common`, and support zero-config module imports across global infrastructure modules:
  
  - `@nest-boot/health-check`: Replace `HealthCheckMiddleware` and the `@nest-boot/middleware` dependency with a `VERSION_NEUTRAL` dynamic `HealthCheckController` defaulting to `path: "/health"` and `decorators: [Public()]`, and add `HealthCheckModule.forRoot` / `forRootAsync` while preserving direct `HealthCheckModule` imports.
  - `@nest-boot/metrics`: Switch `MetricsModule` to `forRoot` / `forRootAsync` (preserving direct `MetricsModule` imports) and convert `MetricsController` to a `VERSION_NEUTRAL` dynamic controller supporting `path` (default `"/metrics"`) and `decorators` (default `[]`, without `@Public()`).
  - `@nest-boot/mastra`: Default `MastraModule` to headless mode (`server` disabled unless `server: true` or `server: { ... }` is configured), replace the `RouterModule` metadata binding with `createDynamicController`, rename the top-level `api` option (`MastraApiOptions` / `normalizeMastraApiOptions` / `resolveMastraApiPrefix` / `DEFAULT_MASTRA_API_PREFIX`) to `server` (`MastraServerOptions` / `normalizeMastraServerOptions` / `resolveMastraServerPrefix` / `DEFAULT_MASTRA_SERVER_PREFIX`), add `server.decorators` defaulting to `[Can("manage", Mastra)]`, and mark `MastraController` `VERSION_NEUTRAL`.
  - `@nest-boot/jwt`: Support zero-config direct `JwtModule` imports using environment-backed issuer defaults (`AUTH_URL ?? APP_URL`), `CryptService` signing key encryption, and the default public `/.well-known/jwks.json` controller.
  - `@nest-boot/common`: Support `enabled?: boolean` on `DynamicControllerOptions` to skip mounting disabled dynamic controllers, generate a per-container runtime controller subclass during module initialization so base/caller metadata and concurrent applications remain isolated, and raise minimum `@nestjs/common` / `@nestjs/core` peer dependencies across the updated packages to `^12.6.0`.
- 82fbb6c: Add `@Can`-based agent capability discovery filtering and `Tool` provider auto-discovery in `@nest-boot/mastra`:
  
  - Automatically discover singleton `BaseTool` and Mastra `Tool` providers in `MastraManager` (`getTools`, `getTool`) and conceal constructor-injected DI properties from Mastra object serializers.
  - Automatically filter `@Can(...)`-protected tools, sub-agents, and workflows in `BaseAgent` (and `MastraManager`-registered `Agent` instances) across `listTools()`, `listAgents()`, and `listWorkflows()` (including `__fork()` clones and recursive sub-agents), while leaving unannotated primitives and direct NestJS internal invocations unrestricted.

### Patch Changes

- fb157be: Reorganize internal source/test layout (`agents/`, `steps/`, `tools/`, `workflows/`, `interfaces/`, `types/`, `utils/`, and `*.spec-d.ts`) and fix `StepExecuteParams` / `StepInput` schema inference on concrete `BaseStep` subclasses.
- Updated dependencies [043a007]
- Updated dependencies [ce0a4d3]
- Updated dependencies [5c2a6bf]
- Updated dependencies [97fad07]
- Updated dependencies [361f26f]
- Updated dependencies [8f3375a]
- Updated dependencies [169da36]
  - @nest-boot/auth@8.7.0
  - @nest-boot/common@8.0.1

## 8.1.0

### Minor Changes

- 15df025: Add `@nest-boot/mastra` for NestJS-native Mastra integration with injectable `BaseAgent`, `BaseTool`, `BaseStep`, and `BaseWorkflow` base classes, singleton provider auto-discovery, Express 5-compatible `/api/mastra` HTTP API protected by `@Can("manage", Mastra)`, embedded Mastra Studio middleware at `/api/mastra/studio`, and environment-driven PostgreSQL (`MASTRA_DATABASE_URL ?? DATABASE_URL`) / ClickHouse (`MASTRA_CLICKHOUSE_URL`) storage and observability defaults.
