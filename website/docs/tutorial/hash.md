---
sidebar_position: 2
---

# Hash

The `@nest-boot/hash` module provides password hashing utilities using the Argon2 algorithm, via `@node-rs/argon2`.

## Installation

```bash
npm install @nest-boot/hash @node-rs/argon2
# or
pnpm add @nest-boot/hash @node-rs/argon2
```

## Setup

Register the `HashModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    HashModule.register({
      // secret: process.env.HASH_SECRET, // Optional if HASH_SECRET or APP_SECRET env var is set
    }),
  ],
})
export class AppModule {}
```

## Usage

Inject `HashService` to hash and verify passwords.

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";

@Injectable()
export class AuthService {
  constructor(private readonly hashService: HashService) {}

  async hashPassword(password: string) {
    return await this.hashService.hash(password);
  }

  async validatePassword(password: string, hash: string) {
    return await this.hashService.verify(hash, password);
  }
}
```

Argon2 is a modern, secure password hashing algorithm. The module handles salt generation and configuration automatically.
