---
sidebar_position: 7
---

# 认证

`@nest-boot/auth` 模块提供基于 [better-auth](https://www.better-auth.com/) 的认证和会话管理，支持 MikroORM 持久化和自动中间件注册。

## 安装

```bash
npm install @nest-boot/auth better-auth
# 或
pnpm add @nest-boot/auth better-auth
```

## 基本用法

### 模块注册

在应用模块中注册 `AuthModule`：

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

### 异步注册

从其他服务获取配置：

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

## 使用 AuthService

注入 `AuthService` 访问 better-auth API：

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

## 自定义实体

可以通过继承基础实体来提供自定义的 `Account` 和 `Verification` 实体类：

```typescript
import { Entity, Property } from "@mikro-orm/core";
import { BaseAccount } from "@nest-boot/auth";

@Entity()
export class Account extends BaseAccount {
  @Property({ nullable: true })
  displayName?: string;
}
```

将自定义实体传递给模块：

```typescript
AuthModule.forRoot({
  secret: process.env.AUTH_SECRET,
  entities: {
    account: Account,
  },
});
```

## 中间件配置

认证中间件默认会自动注册到所有路由。你可以自定义其行为：

```typescript
AuthModule.forRoot({
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth/", // 默认认证 API 路径
  middleware: {
    register: true, // 设为 false 禁用自动注册
    excludeRoutes: ["/health", "/metrics"],
    includeRoutes: ["*"],
  },
});
```

## 环境变量

| 变量          | 描述                                 |
| ------------- | ------------------------------------ |
| `AUTH_SECRET` | 用于签名令牌的密钥（最少 32 个字符） |
| `APP_SECRET`  | 备用密钥                             |
| `AUTH_URL`    | 认证端点的基础 URL                   |
| `APP_URL`     | 备用基础 URL                         |

## 行级安全 (RLS)

`@nest-boot/auth-rls` 包扩展了认证模块，支持 PostgreSQL 行级安全策略，通过中间件自动应用安全上下文。

### 安装

```bash
npm install @nest-boot/auth-rls
# 或
pnpm add @nest-boot/auth-rls
```

### 用法

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

### 工作原理

- RLS 中间件通过 `SET LOCAL` 自动在 PostgreSQL 中设置已认证用户的上下文
- 使用 `AuthRlsContext` 将会话数据映射到数据库级别的安全上下文
- 依赖 `RequestTransactionMiddleware` 确保每个请求在数据库事务中运行
- 中间件在认证中间件之后按顺序执行

### 中间件配置

```typescript
AuthRlsModule.forRoot({
  middleware: {
    register: true,
    excludeRoutes: ["/public"],
  },
});
```

## 安全说明

- 认证密钥长度必须至少 32 个字符
- 生产环境请使用随机生成的密钥
- 模块会验证密钥熵值（最低 120 位）
- 生成安全密钥：`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## API 参考

查看完整的 API 文档获取详细信息：

- [@nest-boot/auth](/docs/api/@nest-boot/auth)
- [@nest-boot/auth-rls](/docs/api/@nest-boot/auth-rls)

## 特性

- **better-auth 集成** - 通过 NestJS 依赖注入使用完整的 better-auth API
- **MikroORM 适配器** - 内置数据库适配器用于会话持久化
- **自动中间件** - 自动注册中间件，支持配置路由
- **自定义实体** - 可扩展的账户和验证实体
- **行级安全** - 通过 auth-rls 模块支持 PostgreSQL RLS
- **密钥验证** - 强制最小长度和熵值要求
