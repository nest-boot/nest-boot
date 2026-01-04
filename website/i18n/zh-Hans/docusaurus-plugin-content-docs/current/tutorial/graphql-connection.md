---
sidebar_position: 7
---

# GraphQL 分页

`@nest-boot/graphql-connection` 模块为 GraphQL API 提供基于游标的分页功能，遵循 [Relay Connection 规范](https://relay.dev/graphql/connections.htm)。它与 MikroORM 集成，生成类型安全的分页查询，支持过滤、排序和搜索功能。

## 安装

```bash
npm install @nest-boot/graphql-connection @nest-boot/graphql @mikro-orm/core
# 或
pnpm add @nest-boot/graphql-connection @nest-boot/graphql @mikro-orm/core
```

## 基本用法

### 模块注册

在应用模块中注册 `GraphQLConnectionModule`：

```typescript
import { Module } from "@nestjs/common";
import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";

@Module({
  imports: [GraphQLConnectionModule.register()],
})
export class AppModule {}
```

该模块是全局的，只需导入一次。

### 构建 Connection 类型

使用 `ConnectionBuilder` 为实体生成所有必要的 GraphQL 类型：

```typescript
import { ConnectionBuilder } from "@nest-boot/graphql-connection";
import { User } from "./user.entity";

export const {
  Connection: UserConnection,
  ConnectionArgs: UserConnectionArgs,
  Edge: UserEdge,
  Order: UserOrder,
  Filter: UserFilter,
} = new ConnectionBuilder(User)
  .addField({ field: "name", type: "string", filterable: true, sortable: true })
  .addField({
    field: "email",
    type: "string",
    filterable: true,
    searchable: true,
  })
  .addField({ field: "createdAt", type: "date", sortable: true })
  .addField({ field: "isActive", type: "boolean", filterable: true })
  .build();
```

### 在解析器中使用

注入 `ConnectionManager` 执行分页查询：

```typescript
import { Resolver, Query, Args } from "@nestjs/graphql";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { UserConnection, UserConnectionArgs } from "./user.connection";

@Resolver()
export class UserResolver {
  constructor(private readonly connectionManager: ConnectionManager) {}

  @Query(() => UserConnection)
  async users(@Args() args: UserConnectionArgs): Promise<UserConnection> {
    return this.connectionManager.find(UserConnection, args);
  }
}
```

## 分页

该模块支持向前和向后分页。

### 向前分页

使用 `first` 和 `after` 进行向前分页：

```graphql
query {
  users(first: 10, after: "cursor123") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### 向后分页

使用 `last` 和 `before` 进行向后分页：

```graphql
query {
  users(last: 10, before: "cursor456") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
}
```

## 过滤

### MongoDB 风格过滤

`filter` 参数接受 MongoDB 查询语法：

```graphql
query {
  users(first: 10, filter: { isActive: true, age: { $gte: 18 } }) {
    edges {
      node {
        id
        name
      }
    }
  }
}
```

支持的操作符：

- `$eq`, `$ne` - 相等性
- `$gt`, `$gte`, `$lt`, `$lte` - 比较
- `$in`, `$nin` - 数组成员
- `$and`, `$or` - 逻辑操作符
- `$regex` - 正则表达式（字符串字段）

### 搜索查询

`query` 参数提供更简单的搜索语法：

```graphql
query {
  users(first: 10, query: "john email:@example.com") {
    edges {
      node {
        id
        name
        email
      }
    }
  }
}
```

搜索语法支持：

- 在可搜索字段中进行纯文本搜索
- 字段特定过滤：`field:value`
- 引号字符串：`"exact phrase"`
- 否定：`-term` 或 `field:-value`

## 排序

使用 `orderBy` 参数对结果排序：

```graphql
query {
  users(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }
}
```

## 字段配置

### 字段类型

使用适当的类型配置字段：

```typescript
new ConnectionBuilder(User)
  .addField({ field: "name", type: "string" })
  .addField({ field: "age", type: "number" })
  .addField({ field: "isActive", type: "boolean" })
  .addField({ field: "createdAt", type: "date" })
  .build();
```

### 字段选项

每个字段可以有以下选项：

```typescript
.addField({
  field: "name",        // 实体属性名
  type: "string",       // 字段类型
  filterable: true,     // 包含在过滤器中（默认：true）
  searchable: true,     // 包含在文本搜索中
  sortable: true,       // 允许按此字段排序
})
```

### 替换字段

对于嵌套或计算字段，使用替换：

```typescript
.addField({
  field: "authorName",
  type: "string",
  replacement: "author.name",  // 映射到嵌套属性
  filterable: true,
})
```

## 附加过滤器

在解析器中添加服务端过滤器：

```typescript
@Query(() => UserConnection)
async activeUsers(@Args() args: UserConnectionArgs): Promise<UserConnection> {
  return this.connectionManager.find(UserConnection, args, {
    where: { isActive: true, deletedAt: null },
  });
}
```

## 过滤器选项

配置过滤器复杂度限制：

```typescript
new ConnectionBuilder(User, {
  filter: {
    maxDepth: 5, // 最大嵌套深度
    maxConditions: 20, // 最大条件数
    maxOrBranches: 5, // 最大 $or 分支数
    maxArrayLength: 100, // $in 的最大数组长度
  },
})
  .addField({ field: "name", type: "string" })
  .build();
```

## 示例：完整设置

```typescript
// user.entity.ts
import { Entity, Property, PrimaryKey } from "@mikro-orm/core";

@Entity()
export class User {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;

  @Property()
  email!: string;

  @Property()
  createdAt: Date = new Date();

  @Property()
  isActive: boolean = true;
}

// user.connection.ts
import { ConnectionBuilder } from "@nest-boot/graphql-connection";
import { User } from "./user.entity";

export const {
  Connection: UserConnection,
  ConnectionArgs: UserConnectionArgs,
} = new ConnectionBuilder(User)
  .addField({
    field: "name",
    type: "string",
    filterable: true,
    searchable: true,
    sortable: true,
  })
  .addField({
    field: "email",
    type: "string",
    filterable: true,
    searchable: true,
  })
  .addField({ field: "createdAt", type: "date", sortable: true })
  .addField({ field: "isActive", type: "boolean", filterable: true })
  .build();

// user.resolver.ts
import { Resolver, Query, Args } from "@nestjs/graphql";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { UserConnection, UserConnectionArgs } from "./user.connection";

@Resolver()
export class UserResolver {
  constructor(private readonly connectionManager: ConnectionManager) {}

  @Query(() => UserConnection)
  async users(@Args() args: UserConnectionArgs): Promise<UserConnection> {
    return this.connectionManager.find(UserConnection, args);
  }
}
```

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/graphql-connection) 获取详细信息。

## 特性

- **Relay 兼容** - 遵循 Relay Connection 规范
- **类型安全** - 使用 TypeScript 泛型完全类型化
- **MikroORM 集成** - 与 MikroORM 实体无缝配合
- **MongoDB 风格过滤** - 强大的过滤语法与验证
- **搜索语法** - 人性化的搜索查询解析
- **基于游标的分页** - 使用不透明游标的稳定分页
- **可配置限制** - 通过复杂度限制防止滥用
