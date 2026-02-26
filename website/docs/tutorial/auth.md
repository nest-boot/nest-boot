---
sidebar_position: 1
---

# Authentication

The `@nest-boot/auth` module provides a comprehensive authentication solution for NestJS applications, integrated with [Better Auth](https://www.better-auth.com/).

## Installation

```bash
npm install @nest-boot/auth better-auth
# or
pnpm add @nest-boot/auth better-auth
```

## Setup

First, you need to define your entities extending the base entities provided by `@nest-boot/auth`.

```typescript
// user.entity.ts
import { Entity } from "@mikro-orm/core";
import { BaseUser } from "@nest-boot/auth";

@Entity()
export class User extends BaseUser {}

// session.entity.ts
import { Entity } from "@mikro-orm/core";
import { BaseSession } from "@nest-boot/auth";

@Entity()
export class Session extends BaseSession {}

// account.entity.ts
import { Entity } from "@mikro-orm/core";
import { BaseAccount } from "@nest-boot/auth";

@Entity()
export class Account extends BaseAccount {}

// verification.entity.ts
import { Entity } from "@mikro-orm/core";
import { BaseVerification } from "@nest-boot/auth";

@Entity()
export class Verification extends BaseVerification {}
```

Then, register the `AuthModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "@nest-boot/auth";
import { User, Session, Account, Verification } from "./entities";

@Module({
  imports: [
    AuthModule.forRoot({
      entities: {
        user: User,
        session: Session,
        account: Account,
        verification: Verification,
      },
      // Better Auth options
      emailAndPassword: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

## Usage

### Guards

Use `AuthGuard` to protect your routes.

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nest-boot/auth";

@Controller("profile")
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile() {
    // ...
  }
}
```

### Decorators

Use `@CurrentUser` and `@CurrentSession` to access the current user and session.

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  AuthGuard,
  CurrentUser,
  CurrentSession,
  BaseUser,
  BaseSession,
} from "@nest-boot/auth";

@Controller("profile")
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile(
    @CurrentUser() user: BaseUser,
    @CurrentSession() session: BaseSession,
  ) {
    return user;
  }
}
```

### Public Routes

Use `@Public` decorator to mark routes as public when `AuthGuard` is applied globally or at controller level.

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard, Public } from "@nest-boot/auth";

@Controller()
@UseGuards(AuthGuard)
export class AppController {
  @Get("public")
  @Public()
  publicRoute() {
    return "This is public";
  }
}
```
