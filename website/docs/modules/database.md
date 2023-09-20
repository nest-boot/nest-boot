---
sidebar_position: 3
---

# 数据库 Database

本文档旨在帮助用户在 Nest Boot 中开始使用 MikroORM。MikroORM 是基于数据映射器、工作单元和身份映射模式的 Node.js TypeScript ORM。它是 TypeORM 的一个很好的替代品，并且从 TypeORM 迁移应该相当容易。[有关 MikroORM 的完整文档可以在此处](https://mikro-orm.io/docs)找到。

数据库模块底层基于 `@mikro-orm/nestjs`，在 `@mikro-orm/nestjs` 基础上做一些预设参数优化，并添加了一些辅助工具函数。 在遇到一些问题的时候也可以参考 [@mikro-orm/nestjs 官方文档](https://mikro-orm.io/docs/usage-with-nestjs) 。

## 安装依赖

按照方式和 `@mikro-orm/nestjs` 基本没有区别，就是多安装了一个 `@nest-boot/database`：

```shell
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mongodb     # for mongo
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mysql       # for mysql/mariadb
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/mariadb     # for mysql/mariadb
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql  # for postgresql
$ npm i -s @nest-boot/database @mikro-orm/core @mikro-orm/nestjs @mikro-orm/sqlite      # for sqlite

```

## 导入模块

依赖安装完成后，在根模块（AppModule）中导入数据库模块（DatabaseModule）：

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

`forRoot()` 方法从 MikroORM 包中接受与 `init()` 相同的配置对象。  
详细配置参考[完整配置文档](https://mikro-orm.io/docs/configuration)。

之后可以在整个项目中注入 EntityManager 和 MikroORM（因为是全局模块所以无需在其他地方导入任何模块）。

```typescript
import { MikroORM } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";

@Injectable()
export class MyService {
  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
  ) {}
}
```

## 实体服务

实体服务主要是扩展了默认存储库中不存在的方法，可以配合 SearchModule 和 GraphQLModule 提供更多功能。

```typescript
import { EntityManager } from "@mikro-orm/postgresql";
import { createEntityService } from "@nest-boot/database";
import { Injectable } from "@nestjs/common";

import { Post } from "./post.entity";

@Injectable()
export class PostService extends createEntityService(Post, EntityManager) {
  // ...
}
```

## 使用命令行工具

### 安装依赖

```shell
$ npm i -s @mikro-orm/cli @mikro-orm/migrations @mikro-orm/seeder
```

### 配置文件

和官方推荐的做法不同，我们推荐在模块注册时配置数据库配置。  
然后在 `src/mikro-orm.config.ts` 中使用 `defineConfig` 工具函数获取根模块中的数据库配置。  
这样做可以使用其他模块在不同的地方（配置中心）加载数据库配置。

```typescript
// src/mikro-orm.config.ts
import { defineConfig } from "@nest-boot/database";

import { AppModule } from "./app.module";

export default defineConfig(AppModule);
```

## 预设默认配置

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
