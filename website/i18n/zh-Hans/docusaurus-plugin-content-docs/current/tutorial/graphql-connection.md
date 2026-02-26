---
sidebar_position: 2
---

# GraphQL Connection

`@nest-boot/graphql-connection` 模块简化了使用 MikroORM 为 GraphQL 实现基于 Relay 风格的游标分页的过程。

## 安装

```bash
npm install @nest-boot/graphql-connection
# or
pnpm add @nest-boot/graphql-connection
```

## 配置

在你的应用程序模块中注册 `GraphQLConnectionModule`。

```typescript
import { Module } from "@nestjs/common";
import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";

@Module({
  imports: [GraphQLConnectionModule.forRoot()],
})
export class AppModule {}
```

## 使用

### 定义连接类型

使用 `ConnectionBuilder` 为你的实体创建连接类型。

```typescript
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
    sortable: true,
    searchable: true,
  })
  .addField({
    field: "email",
    type: "string",
    filterable: true,
    searchable: true,
  })
  .addField({
    field: "createdAt",
    type: "date",
    sortable: true,
  })
  .build();
```

### 在解析器中使用

注入 `ConnectionManager` 并使用它来查找分页结果。

```typescript
// user.resolver.ts
import { Resolver, Query, Args } from "@nestjs/graphql";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { User } from "./user.entity";
import { UserConnection, UserConnectionArgs } from "./user.connection";

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly connectionManager: ConnectionManager) {}

  @Query(() => UserConnection)
  async users(@Args() args: UserConnectionArgs): Promise<UserConnection> {
    return this.connectionManager.find(UserConnection, args);
  }
}
```

生成的连接参数支持：

- 分页：`first`, `last`, `after`, `before`
- 排序：`orderBy` (例如 `orderBy: { field: NAME, direction: ASC }`)
- 过滤：`filter` (例如 `filter: { name: { eq: "John" } }`)
- 搜索：`query` (在可搜索字段中搜索)
