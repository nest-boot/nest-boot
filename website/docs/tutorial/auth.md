---
sidebar_position: 7
---

# Auth

The `@nest-boot/auth` module provides authentication and session management built on [better-auth](https://www.better-auth.com/), with MikroORM persistence and automatic middleware registration.

## Installation

```bash
npm install @nest-boot/auth better-auth
# or
pnpm add @nest-boot/auth better-auth
```

## Basic Usage

### Module Registration

Register the `AuthModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "@nest-boot/auth";

@Module({
  imports: [
    AuthModule.forRoot({
      secret: process.env.AUTH_SECRET,
    }),
  ],
})
export class AppModule {}
```

### Async Registration

For configuration from other services:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "@nest-boot/auth";

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("AUTH_SECRET"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Using AuthService

Inject the `AuthService` to access the better-auth API:

```typescript
import { Injectable } from "@nestjs/common";
import { AuthService } from "@nest-boot/auth";

@Injectable()
export class UserService {
  constructor(private readonly authService: AuthService) {}

  async getSession(headers: Headers) {
    const session = await this.authService.api.getSession({ headers });
    return session;
  }
}
```

## Custom Entities

You can provide custom `Account` and `Verification` entity classes by extending the base entities:

```typescript
import { Entity, Property } from "@mikro-orm/core";
import { BaseAccount } from "@nest-boot/auth";

@Entity()
export class Account extends BaseAccount {
  @Property({ nullable: true })
  displayName?: string;
}
```

Pass custom entities to the module:

```typescript
AuthModule.forRoot({
  secret: process.env.AUTH_SECRET,
  entities: {
    account: Account,
  },
});
```

## Middleware Configuration

The auth middleware is automatically registered for all routes. You can customize its behavior:

```typescript
AuthModule.forRoot({
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth/", // Default auth API path
  middleware: {
    register: true, // Set to false to disable auto-registration
    excludeRoutes: ["/health", "/metrics"],
    includeRoutes: ["*"],
  },
});
```

## Environment Variables

| Variable      | Description                                       |
| ------------- | ------------------------------------------------- |
| `AUTH_SECRET` | Secret key for signing tokens (min 32 characters) |
| `APP_SECRET`  | Fallback secret key                               |
| `AUTH_URL`    | Base URL for auth endpoints                       |
| `APP_URL`     | Fallback base URL                                 |

## Row-Level Security (RLS)

The `@nest-boot/auth-rls` package extends the auth module with PostgreSQL Row-Level Security support, automatically applying security context through middleware.

### Installation

```bash
npm install @nest-boot/auth-rls
# or
pnpm add @nest-boot/auth-rls
```

### Usage

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "@nest-boot/auth";
import { AuthRlsModule } from "@nest-boot/auth-rls";

@Module({
  imports: [
    AuthModule.forRoot({
      secret: process.env.AUTH_SECRET,
    }),
    AuthRlsModule.forRoot({}),
  ],
})
export class AppModule {}
```

### How It Works

- The RLS middleware automatically sets the authenticated user context in PostgreSQL via `SET LOCAL`
- Uses `AuthRlsContext` to map session data to database-level security context
- Depends on `RequestTransactionMiddleware` to ensure each request runs within a database transaction
- The middleware runs after the auth middleware in the middleware chain

### Middleware Configuration

```typescript
AuthRlsModule.forRoot({
  middleware: {
    register: true,
    excludeRoutes: ["/public"],
  },
});
```

## Security Notes

- The auth secret must be at least 32 characters long
- Use a randomly generated secret for production
- The module validates secret entropy (minimum 120 bits)
- Generate a secure secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## API Reference

See the full API documentation for detailed information:

- [@nest-boot/auth](/docs/api/@nest-boot/auth)
- [@nest-boot/auth-rls](/docs/api/@nest-boot/auth-rls)

## Features

- **better-auth Integration** - Full better-auth API with NestJS DI
- **MikroORM Adapter** - Built-in database adapter for session persistence
- **Auto Middleware** - Automatic middleware registration with configurable routes
- **Custom Entities** - Extensible account and verification entities
- **Row-Level Security** - PostgreSQL RLS support via auth-rls module
- **Secret Validation** - Enforces minimum length and entropy requirements
