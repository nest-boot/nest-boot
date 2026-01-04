---
sidebar_position: 3
---

# MikroORM

The `@nest-boot/mikro-orm` module provides seamless integration with [MikroORM](https://mikro-orm.io/), a TypeScript ORM for Node.js. It includes automatic configuration from environment variables, request context integration, and support for encrypted and hashed entity properties.

## Installation

```bash
npm install @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/reflection
# or
pnpm add @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/reflection
```

You also need to install a database driver:

```bash
# For PostgreSQL
pnpm add @mikro-orm/postgresql

# For MySQL
pnpm add @mikro-orm/mysql
```

## Basic Usage

### Module Registration

Register the `MikroOrmModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    MikroOrmModule.register({
      entities: ["dist/**/*.entity.js"],
      entitiesTs: ["src/**/*.entity.ts"],
    }),
  ],
})
export class AppModule {}
```

### Using Environment Variables

The module automatically loads configuration from environment variables if no options are provided:

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    // Will use DB_* or DATABASE_* environment variables
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### Async Registration

For configuration from other services:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MikroOrmModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        clientUrl: config.get("DATABASE_URL"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Registering Entities

Use `MikroOrmModule.forFeature()` to register entities for a specific module:

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  providers: [UserService],
})
export class UserModule {}
```

## Environment Variables

The module supports automatic configuration from the following environment variables:

| Variable                                      | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `DB_URL` or `DATABASE_URL`                    | Full database connection URL (takes precedence)   |
| `DB_TYPE` or `DATABASE_TYPE`                  | Database type (`mysql`, `postgres`, `postgresql`) |
| `DB_HOST` or `DATABASE_HOST`                  | Database server hostname                          |
| `DB_PORT` or `DATABASE_PORT`                  | Database server port                              |
| `DB_NAME` or `DB_DATABASE` or `DATABASE_NAME` | Database name                                     |
| `DB_USER` or `DB_USERNAME` or `DATABASE_USER` | Database username                                 |
| `DB_PASS` or `DB_PASSWORD` or `DATABASE_PASS` | Database password                                 |

## Default Configuration

The module provides sensible defaults:

- **Dataloader**: Enabled for all relations
- **Timezone**: UTC
- **Metadata Provider**: TsMorphMetadataProvider
- **Entities Path**: `dist/**/*.entity.js` / `src/**/*.entity.ts`
- **Migrations Path**: `dist/database/migrations` / `src/database/migrations`
- **Seeders Path**: `dist/database/seeders` / `src/database/seeders`

## Encrypted Properties

The `@nest-boot/mikro-orm-crypt` package provides a decorator for automatically encrypting entity properties before they are persisted to the database.

### Use Cases

Encryption is ideal for sensitive data that needs to be retrieved in its original form:

- **Personal Identifiable Information (PII)**: Social Security Numbers, ID card numbers, passport numbers
- **Financial Data**: Credit card numbers, bank account numbers
- **Medical Records**: Health information, medical history
- **Contact Information**: Phone numbers, addresses (when privacy is required)
- **API Keys and Tokens**: Third-party service credentials stored per user
- **Private Notes**: User notes or comments containing sensitive content

### Installation

```bash
npm install @nest-boot/mikro-orm-crypt @nest-boot/crypt
# or
pnpm add @nest-boot/mikro-orm-crypt @nest-boot/crypt
```

### Usage

Use the `@EncryptedProperty()` decorator to mark properties that should be encrypted:

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { EncryptedProperty } from "@nest-boot/mikro-orm-crypt";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @EncryptedProperty({ type: t.string })
  ssn!: string;

  @EncryptedProperty({ type: t.text })
  creditCard!: string;
}
```

### How It Works

- Properties marked with `@EncryptedProperty()` are automatically encrypted before `create` and `update` operations
- Encryption uses AES-256-GCM via `@nest-boot/crypt`
- Already encrypted values (JWE format) are skipped to prevent double encryption
- The property is marked as `hidden: true` and `lazy: true` by default

### Configuration

Make sure to configure `CryptModule` with a secret key:

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### Decrypting Data

Use `CryptService` to decrypt encrypted fields:

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";
import { EntityManager } from "@mikro-orm/core";
import { User } from "./entities/user.entity";

@Injectable()
export class UserService {
  constructor(
    private readonly em: EntityManager,
    private readonly cryptService: CryptService,
  ) {}

  async getUserSSN(userId: number): Promise<string> {
    const user = await this.em.findOneOrFail(User, userId);
    return this.cryptService.decrypt(user.ssn);
  }
}
```

## Hashed Properties

The `@nest-boot/mikro-orm-hash` package provides a decorator for automatically hashing entity properties (like passwords) before they are persisted to the database.

### Use Cases

Hashing is ideal for data that only needs to be verified, not retrieved:

- **Passwords**: User login passwords, admin passwords
- **PIN Codes**: Payment PINs, access PINs
- **Security Answers**: Answers to security questions
- **Verification Codes**: One-time codes that need verification

> **Note**: Unlike encryption, hashing is a one-way operation. You cannot retrieve the original value from a hash. Use hashing when you only need to verify that an input matches the stored value.

### Installation

```bash
npm install @nest-boot/mikro-orm-hash @nest-boot/hash
# or
pnpm add @nest-boot/mikro-orm-hash @nest-boot/hash
```

### Usage

Use the `@HashedProperty()` decorator to mark properties that should be hashed:

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { HashedProperty } from "@nest-boot/mikro-orm-hash";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @HashedProperty({ type: t.string })
  password!: string;
}
```

### How It Works

- Properties marked with `@HashedProperty()` are automatically hashed before `create` and `update` operations
- Hashing uses Argon2 algorithm via `@nest-boot/hash`
- Already hashed values (starting with `$argon2`) are skipped to prevent double hashing
- The property is marked as `hidden: true` and `lazy: true` by default

### Configuration

Make sure to configure `HashModule` with a secret key:

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    HashModule.register({
      secret: process.env.HASH_SECRET,
    }),
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### Verifying Passwords

Use `HashService` to verify passwords:

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";
import { EntityManager } from "@mikro-orm/core";
import { User } from "./entities/user.entity";

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly hashService: HashService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.em.findOne(User, { email });

    if (user && (await this.hashService.verify(user.password, password))) {
      return user;
    }

    return null;
  }
}
```

## Complete Example

Here's a complete example combining both encrypted and hashed properties:

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { EncryptedProperty } from "@nest-boot/mikro-orm-crypt";
import { HashedProperty } from "@nest-boot/mikro-orm-hash";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @HashedProperty({ type: t.string })
  password!: string;

  @EncryptedProperty({ type: t.string, nullable: true })
  ssn?: string;

  @EncryptedProperty({ type: t.text, nullable: true })
  notes?: string;
}
```

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";
import { HashModule } from "@nest-boot/hash";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { User } from "./entities/user.entity";

@Module({
  imports: [
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
    HashModule.register({
      secret: process.env.HASH_SECRET,
    }),
    MikroOrmModule.register({}),
    MikroOrmModule.forFeature([User]),
  ],
})
export class AppModule {}
```

## API Reference

See the full API documentation for detailed information:

- [@nest-boot/mikro-orm](/docs/api/@nest-boot/mikro-orm)
- [@nest-boot/mikro-orm-crypt](/docs/api/@nest-boot/mikro-orm-crypt)
- [@nest-boot/mikro-orm-hash](/docs/api/@nest-boot/mikro-orm-hash)

## Features

- **Auto Configuration** - Automatically loads settings from environment variables
- **Request Context Integration** - Automatic EntityManager forking per request
- **Encrypted Properties** - Automatic AES-256-GCM encryption for sensitive data
- **Hashed Properties** - Automatic Argon2 hashing for passwords
- **TsMorph Metadata** - Reflection-based metadata provider
- **Dataloader Support** - Built-in dataloader for optimized relation loading
