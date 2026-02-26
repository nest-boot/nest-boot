---
sidebar_position: 1
---

# 认证 (Authentication)

`@nest-boot/auth` 模块为 NestJS 应用程序提供了全面的认证解决方案，集成了 [Better Auth](https://www.better-auth.com/)。

## 安装

```bash
npm install @nest-boot/auth better-auth
# or
pnpm add @nest-boot/auth better-auth
```

## 配置

首先，你需要定义继承自 `@nest-boot/auth` 提供的基础实体的实体。

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

然后，在你的应用程序模块中注册 `AuthModule`。

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
      // Better Auth 选项
      emailAndPassword: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

## 使用

### 守卫 (Guards)

使用 `AuthGuard` 来保护你的路由。

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

### 装饰器 (Decorators)

使用 `@CurrentUser` 和 `@CurrentSession` 来获取当前用户和会话。

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

### 公开路由 (Public Routes)

当 `AuthGuard` 全局应用或在控制器级别应用时，使用 `@Public` 装饰器将路由标记为公开（不需要认证）。

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
