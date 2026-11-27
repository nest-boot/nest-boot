# @nest-boot/mastra

NestJS-native [Mastra](https://mastra.ai/) integration for Nest Boot with dependency-injected `BaseAgent`, `BaseTool`, `BaseStep`, and `BaseWorkflow` base classes, automatic provider discovery, embedded Mastra Studio, `@nest-boot/auth` route protection, and environment-driven PostgreSQL / ClickHouse storage.

## Installation

```bash
pnpm add @nest-boot/mastra @mastra/core @nest-boot/auth zod
# Optional: install `mastra` to enable embedded Mastra Studio at `/api/mastra/studio`
pnpm add mastra
```

## Quick Start

Import `MastraModule` directly for zero-config headless mode (DI auto-discovery, storage, and observability without HTTP routes or Studio), or pass `{ server: true }` / `{ server: { ... } }` to `forRoot` / `forRootAsync` to expose the Mastra HTTP API and Studio:

```typescript
import { MastraModule } from "@nest-boot/mastra";
import { Module } from "@nestjs/common";

@Module({
  imports: [MastraModule],
})
export class AppModule {}
```

NestJS owns the HTTP listener. Standalone Hono `server` fields (`port`, `host`, `cors`, `middleware`, `apiRoutes`, `auth`, `customRouteAuthConfig`) are forbidden in both TypeScript and at startup, including options returned by `forRootAsync`. Configure `@mastra/nestjs` adapter options (`prefix`, `decorators`, `bodyLimitOptions`, `rateLimitOptions`, `streamOptions`, `mcpOptions`, `shutdownOptions`) under `server`, define custom endpoints with NestJS controllers, and use `@nest-boot/auth` for authorization.

API and Studio paths include the application's global prefix. For example, `app.setGlobalPrefix("v1")` serves the API at `/v1/api/mastra` and Studio at `/v1/api/mastra/studio`.

Register permission mapping in your `AuthModule` `buildAbility` callback to grant access to `/api/mastra/*`:

```typescript
import { Mastra } from "@mastra/core/mastra";

buildAbility: ({ builder, permissions }) => {
  if (permissions.includes("mastra:manage")) {
    builder.can("manage", Mastra);
  }
};
```

## Base Classes

- `BaseAgent` — injectable Mastra `Agent` subclass with automatic kebab-case `id` derivation and automatic exposure-time tool authorization filtering.
- `BaseTool(definition)` — injectable Mastra `Tool` class factory preserving native input/output validation, `super(options)` runtime configuration, and NestJS Guard authorization (`@Can`, `@Public`, `@UseGuards`, `APP_GUARD`).
- `BaseStep(schemas)` — injectable workflow `Step` class factory with full static schema typing.
- `BaseWorkflow(schemas)` — injectable Mastra `Workflow` class factory with lifecycle hooks (`onStart`, `onFinish`, `onError`) and NestJS DI-safe `commit()`.

## Tool Authorization

Singleton `BaseTool` (and Mastra `Tool`) providers are automatically discovered by `MastraManager`, registered in `Mastra`, and protected at two layers via NestJS `ExternalContextCreator`:

1. **Exposure-time filtering (`"mastra:tool:discovery"`)** — `agent.listTools()` (used by `generate()`, `stream()`, Studio, and `/api/mastra/agents/*`) and `/api/mastra/tools*` automatically hide tools whose authentication, static `@Can(action, Subject)`, or `@UseGuards(...)` checks deny access.
2. **Execution-time enforcement (`"mastra:tool:execution"`)** — `tool.execute(...)` runs the full NestJS Guard pipeline (including dynamic `@Can(action, (self, input, context) => ...)` callbacks receiving the schema-validated `input` and tool `context`) before executing the tool body.

Global `APP_GUARD` enhancers (such as `@nest-boot/auth`'s `AuthGuard`) run on both context types, matching `@nestjs/graphql`. Custom `APP_GUARD` implementations that inspect transport-specific objects (e.g. `switchToHttp().getRequest()`) should branch on `context.getType()`. Always read caller identity and permissions from `@nest-boot/auth` (`AuthContext` / `@nest-boot/request-context`); Mastra's `context.requestContext` carries untrusted caller-supplied parameters.

## Environment Variables

| Variable                | Description                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `MASTRA_DATABASE_URL`   | Dedicated PostgreSQL URL for Mastra `PostgresStore` (`schemaName: "mastra"`). Takes precedence over `DATABASE_URL`.           |
| `DATABASE_URL`          | Fallback PostgreSQL URL when `MASTRA_DATABASE_URL` is unset. Non-PostgreSQL URLs (e.g. PGlite) do not enable `PostgresStore`. |
| `MASTRA_CLICKHOUSE_URL` | Optional ClickHouse URL (`http:`, `https:`, `clickhouse:`, `clickhouses:`) enabling `ObservabilityStorageClickhouseVNext`.    |

## Routes

- **Mastra HTTP API**: `/api/mastra/*` (mounted via dynamic controller; protected by `@Can("manage", Mastra)` by default and customizable via `server.decorators`).
- **Mastra Studio**: `/api/mastra/studio` (served via Express middleware; static shell is unauthenticated while API calls go through `server.decorators`).
