---
sidebar_position: 1
---

# MikroORM

The `@nest-boot/mikro-orm` ecosystem provides a set of modules to enhance MikroORM integration with NestJS.

## Core Module

The `@nest-boot/mikro-orm` module provides a thin wrapper around `@mikro-orm/nestjs` and `@mikro-orm/core`, adding support for automatic configuration loading and request context management.

### Installation

```bash
npm install @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql
# or
pnpm add @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql
```

### Setup

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    MikroOrmModule.forRoot({
      // Configuration...
    }),
  ],
})
export class AppModule {}
```

## Encryption (MikroORM Crypt)

The `@nest-boot/mikro-orm-crypt` module provides an `@EncryptedProperty` decorator to automatically encrypt entity properties.

### Installation

```bash
npm install @nest-boot/mikro-orm-crypt @nest-boot/crypt
# or
pnpm add @nest-boot/mikro-orm-crypt @nest-boot/crypt
```

### Usage

First, configure `@nest-boot/crypt` (see Crypt documentation). Then use the decorator in your entity:

```typescript
import { Entity, PrimaryKey, t } from "@mikro-orm/core";
import { EncryptedProperty } from "@nest-boot/mikro-orm-crypt";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @EncryptedProperty({ type: t.text })
  ssn!: string;
}
```

The `ssn` field will be encrypted before being saved to the database and decrypted when loaded.

## Hashing (MikroORM Hash)

The `@nest-boot/mikro-orm-hash` module provides a `@HashedProperty` decorator to automatically hash entity properties (e.g., passwords).

### Installation

```bash
npm install @nest-boot/mikro-orm-hash @nest-boot/hash
# or
pnpm add @nest-boot/mikro-orm-hash @nest-boot/hash
```

### Usage

First, configure `@nest-boot/hash` (see Hash documentation). Then use the decorator in your entity:

```typescript
import { Entity, PrimaryKey, t } from "@mikro-orm/core";
import { HashedProperty } from "@nest-boot/mikro-orm-hash";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @HashedProperty({ type: t.text })
  password!: string;
}
```

The `password` field will be hashed using Argon2 before being saved.

## Request Transaction

The `@nest-boot/mikro-orm-request-transaction` module wraps each HTTP request in a database transaction.

### Installation

```bash
npm install @nest-boot/mikro-orm-request-transaction
# or
pnpm add @nest-boot/mikro-orm-request-transaction
```

### Setup

```typescript
import { Module } from "@nestjs/common";
import { RequestTransactionModule } from "@nest-boot/mikro-orm-request-transaction";

@Module({
  imports: [
    RequestTransactionModule.forRoot(),
  ],
})
export class AppModule {}
```

### Usage

Once registered, every request will start a transaction.
- If the request completes successfully, the transaction is committed.
- If an error occurs, the transaction is rolled back.
- The `EntityManager` obtained via `RequestContext` will be the transactional one.
