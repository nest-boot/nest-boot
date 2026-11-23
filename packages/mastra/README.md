# @nest-boot/mastra

NestJS-native [Mastra](https://mastra.ai/) integration for Nest Boot with dependency-injected `BaseAgent`, `BaseTool`, `BaseStep`, and `BaseWorkflow` base classes, automatic provider discovery, embedded Mastra Studio, `@nest-boot/auth` route protection, and environment-driven PostgreSQL / ClickHouse storage.

## Installation

```bash
pnpm add @nest-boot/mastra @mastra/core @nest-boot/auth zod
# Optional: install `mastra` to enable embedded Mastra Studio at `/api/mastra/studio`
pnpm add mastra
```

## Quick Start

Import `MastraModule` in your root or common module:

```typescript
import { MastraModule } from "@nest-boot/mastra";
import { Module } from "@nestjs/common";

@Module({
  imports: [MastraModule],
})
export class AppModule {}
```

NestJS owns the HTTP server. `server.*` configuration is forbidden in both TypeScript and at startup, including options returned by `forRootAsync`. Define custom endpoints with NestJS controllers and configure authentication, middleware, CORS, and exception handling through NestJS. `api.auth` and `api.customRouteAuthConfig` are also unsupported; use `@nest-boot/auth` for authorization.

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

- `BaseAgent` — injectable Mastra `Agent` subclass with automatic kebab-case `id` derivation.
- `BaseTool(definition)` — injectable Mastra `Tool` class factory preserving native input/output validation and `super(options)` runtime configuration.
- `BaseStep(schemas)` — injectable workflow `Step` class factory with full static schema typing.
- `BaseWorkflow(schemas)` — injectable Mastra `Workflow` class factory with lifecycle hooks (`onStart`, `onFinish`, `onError`) and NestJS DI-safe `commit()`.

## Environment Variables

| Variable                | Description                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `MASTRA_DATABASE_URL`   | Dedicated PostgreSQL URL for Mastra `PostgresStore` (`schemaName: "mastra"`). Takes precedence over `DATABASE_URL`.           |
| `DATABASE_URL`          | Fallback PostgreSQL URL when `MASTRA_DATABASE_URL` is unset. Non-PostgreSQL URLs (e.g. PGlite) do not enable `PostgresStore`. |
| `MASTRA_CLICKHOUSE_URL` | Optional ClickHouse URL (`http:`, `https:`, `clickhouse:`, `clickhouses:`) enabling `ObservabilityStorageClickhouseVNext`.    |

## Routes

- **Mastra HTTP API**: `/api/mastra/*` (protected by `@Can("manage", Mastra)`).
- **Mastra Studio**: `/api/mastra/studio` (served via Express middleware; static shell is unauthenticated while API calls go through `@Can("manage", Mastra)`).
