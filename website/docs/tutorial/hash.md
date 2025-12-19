---
sidebar_position: 1
---

# Hash Module

The `@nest-boot/hash` module provides secure password hashing and verification using the Argon2 algorithm, which is considered one of the most secure hashing algorithms available.

## Installation

```bash
npm install @nest-boot/hash
# or
pnpm add @nest-boot/hash
```

## Basic Usage

### Module Registration

Register the `HashModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    HashModule.register({
      secret: "your-secret-key",
    }),
  ],
})
export class AppModule {}
```

### Async Registration

For configuration from environment variables or other async sources:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    ConfigModule.forRoot(),
    HashModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("HASH_SECRET"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Using HashService

Inject the `HashService` into your service or controller:

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";

@Injectable()
export class AuthService {
  constructor(private readonly hashService: HashService) {}

  async hashPassword(password: string): Promise<string> {
    return this.hashService.create(password);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return this.hashService.verify(hash, password);
  }
}
```

## API Reference

See the full [API documentation](/docs/api/@nest-boot/hash) for detailed information.

## Configuration Options

| Option   | Type     | Description                                                                                                         |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `secret` | `string` | The secret key used for hashing. Falls back to `HASH_SECRET` or `APP_SECRET` environment variables if not provided. |

## Environment Variables

The module supports the following environment variables as fallbacks:

- `HASH_SECRET` - Primary fallback for the secret key
- `APP_SECRET` - Secondary fallback for the secret key
