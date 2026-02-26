---
sidebar_position: 1
---

# MikroORM

`@nest-boot/mikro-orm` 生态系统提供了一组模块，用于增强 MikroORM 与 NestJS 的集成。

## 核心模块 (Core Module)

`@nest-boot/mikro-orm` 模块是对 `@mikro-orm/nestjs` 和 `@mikro-orm/core` 的一层薄封装，增加了对自动配置加载和请求上下文管理的支持。

### 安装

```bash
npm install @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql
# or
pnpm add @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql
```

### 配置

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    MikroOrmModule.forRoot({
      // 配置...
    }),
  ],
})
export class AppModule {}
```

## 加密 (MikroORM Crypt)

`@nest-boot/mikro-orm-crypt` 模块提供了一个 `@EncryptedProperty` 装饰器，用于自动加密实体属性。

### 安装

```bash
npm install @nest-boot/mikro-orm-crypt @nest-boot/crypt
# or
pnpm add @nest-boot/mikro-orm-crypt @nest-boot/crypt
```

### 使用

首先，配置 `@nest-boot/crypt`（参见 Crypt 文档）。然后在你的实体中使用该装饰器：

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

`ssn` 字段在保存到数据库之前会被加密，在加载时会被解密。

## 哈希 (MikroORM Hash)

`@nest-boot/mikro-orm-hash` 模块提供了一个 `@HashedProperty` 装饰器，用于自动哈希实体属性（例如密码）。

### 安装

```bash
npm install @nest-boot/mikro-orm-hash @nest-boot/hash
# or
pnpm add @nest-boot/mikro-orm-hash @nest-boot/hash
```

### 使用

首先，配置 `@nest-boot/hash`（参见 Hash 文档）。然后在你的实体中使用该装饰器：

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

`password` 字段在保存之前将使用 Argon2 进行哈希处理。

## 请求事务 (Request Transaction)

`@nest-boot/mikro-orm-request-transaction` 模块将每个 HTTP 请求包装在一个数据库事务中。

### 安装

```bash
npm install @nest-boot/mikro-orm-request-transaction
# or
pnpm add @nest-boot/mikro-orm-request-transaction
```

### 配置

```typescript
import { Module } from "@nestjs/common";
import { RequestTransactionModule } from "@nest-boot/mikro-orm-request-transaction";

@Module({
  imports: [RequestTransactionModule.forRoot()],
})
export class AppModule {}
```

### 使用

一旦注册，每个请求都将启动一个事务。

- 如果请求成功完成，事务将被提交。
- 如果发生错误，事务将被回滚。
- 通过 `RequestContext` 获取的 `EntityManager` 将是事务性的。
