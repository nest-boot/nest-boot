---
sidebar_position: 3
---

# 数据库

数据库模块底层基于 `@mikro-orm/nestjs`，在 `@mikro-orm/nestjs` 基础上做一些预设参数优化，并添加了一些辅助工具函数。
在遇到一些问题的时候也可以参考 [@mikro-orm/nestjs](https://mikro-orm.io/docs/usage-with-nestjs) 官方文档。

## 安装

按照方式和 `@mikro-orm/nestjs` 基本没有区别，就是多安装了一个 `@nest-boot/database`：

```shell
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mongodb     # for mongo
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mysql       # for mysql/mariadb
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mariadb     # for mysql/mariadb
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql  # for postgresql
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/sqlite      # for sqlite

```

如果有使用命令行工具再安装：

```shell
$ npm i -s @mikro-orm/cli @mikro-orm/migrations @mikro-orm/seeder
```

依赖安装完成后在根模块（AppModule）中导入数据库模块：

```typescript
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        driver: PostgreSqlDriver,
        host: config.get("DATABASE_HOST"),
        port: config.get("DATABASE_PORT"),
        dbName: config.get("DATABASE_NAME"),
        name: config.get("DATABASE_USERNAME"),
        password: config.get("DATABASE_PASSWORD"),
      }),
    }),
    // ...
  ],
  // ...
})
export class AppModule {}
```

## 预设默认参数

默认预设了一些方便使用的参数，你可以在注册模块的时候覆盖它们。

```typescript
const options = {
  // 默认使用 UTC 时区
  timezone: "UTC",
  // 使用 ts-morph
  metadataProvider: TsMorphMetadataProvider,
  entities: ["dist/**/*.entity.js"],
  entitiesTs: ["src/**/*.entity.ts"],
  migrations: {
    // 默认关闭快照
    snapshot: false,
    path: "dist/database/migrations",
    pathTs: "src/database/migrations",
    // 使用 sql-formatter + prettier 美化生成的 SQL
    generator: MigrationGenerator,
  },
  seeder: {
    path: "dist/database/seeders",
    pathTs: "src/database/seeders",
    defaultSeeder: "Seeder",
    fileName: (className: string) => className,
  },
};
```

## 使用命令行工具

和官方推荐的做法不同，我们推荐在模块注册时配置数据库设置。然后在 `src/mikro-orm.config.ts` 中利用 `defineConfig` 工具函数获取模块中的数据库设置给命令行工具读取使用。这样做可以使用其他模块在不同的地方（配置中心）加载数据库配置。

```typescript
// src/mikro-orm.config.ts
import { defineConfig } from "@nest-boot/database";

import { AppModule } from "./app.module";

export default defineConfig(AppModule);
```

## 实体服务

```typescript

```

## 常见问题

1. 1  
   参考官方文档[在队列中使用请求范围处理程序](https://mikro-orm.io/docs/usage-with-nestjs#request-scoped-handlers-in-queues)。
