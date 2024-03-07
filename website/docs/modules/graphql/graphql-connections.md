---
sidebar_position: 6
---

# GraphQL 分页

`@nest-boot/graphql-connection` 模块是一个 Nest.js GraphQL 游标分页解决方案。  
它可以根据 Mikro ORM 实体类，快速生成 GraphQL [代码优先](https://docs.nestjs.com/graphql/quick-start#code-first)模式下 GraphQL 游标分页的定义代码，并且帮助你完成解决器的代码编写。

## 安装

```
pnpm add @nest-boot/graphql-connection
```

## 快速入门

### 注册并导入模块

```typescript
@Module({
  imports: [
    GraphQLConnectionModule.register({
      isGlobal: true,
    });
  ],
})
export class AppModule {}
```

### 定义 MikroORM 实体

```typescript
// src/post/post.entity.ts

import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/core";
import { FullTextType } from "@mikro-orm/postgresql";
import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { randomUUID } from "crypto";

import { User } from "../user/user.entity";

@ObjectType()
@Entity()
export class Post {
  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
  })
  id: string = randomUUID();

  @Field({ complexity: 5 })
  @Property()
  title: string;

  @Field()
  @Property({ type: "text" })
  content: string;

  @Index({ type: "fulltext" })
  @Property({
    type: FullTextType,
    onUpdate: (post: Post) => post.content,
    hidden: true,
  })
  searchableContent: string;

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

### 使用连接构建器生成连接定义

```typescript
// src/post/post.connection-definition.ts

import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Post } from "./post.entity";
import { ArgsType, ObjectType } from "@nestjs/graphql";

export const { Connection, ConnectionArgs } = new ConnectionBuilder(Post)
  .addField({ field: "id", filterable: true })
  .addField({ field: "title", filterable: true, searchable: true })
  .addField({
    field: "content",
    replacement: "searchableContent",
    filterable: true,
    searchable: true,
  })
  .addField({ field: "user_id", replacement: "user.id", filterable: true })
  .addField({ field: "created_at", replacement: "createdAt", sortable: true })
  .addField({
    field: "published",
    type: "boolean",
    filterable: true,
    replacement: ({ value }) => {
      return value
        ? { publishedAt: { $eq: null } }
        : { publishedAt: { $ne: null } };
    },
  })
  .build();

@ArgsType()
export class PostConnectionArgs extends ConnectionArgs {}

@ObjectType()
export class PostConnection extends Connection {}
```

连接构建器会帮你生成 `Connection`, `ConnectionArgs`, `Edge`, `Order` 等类型定义。
你还可以通过 `addField` 方法指示连接构建器生成字段定义的查询和排序行为。

### 在解决器中使用

在解决器中导入 `ConnectionManager` 就可以很快速的编写一个符合 GraphQL 游标分页的接口了。

```typescript
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { Args, Query, Resolver } from "@nestjs/graphql";

import {
  PostConnection,
  PostConnectionArgs,
} from "./post.connection-definition";

@Resolver(Post)
export class PostResolver {
  constructor(private readonly cm: ConnectionManager) {}

  @Query(() => PostConnection)
  async posts(@Args() args: PostConnectionArgs): Promise<PostConnection> {
    return await this.cm.find(PostConnection, args);
  }
}
```

### 参考架构

以上步骤完成后生成的 GraphQL 架构参考如下：

```graphql
"""
An auto-generated type which holds one Post and a cursor during pagination.
"""
type PostEdge {
  """
  The item at the end of PostEdge.
  """
  node: Post!

  """
  A cursor for use in pagination.
  """
  cursor: String!
}

type PostConnection {
  """
  A list of edges.
  """
  edges: [PostEdge!]!

  """
  Information to aid in pagination.
  """
  pageInfo: PageInfo!

  """
  Identifies the total count of items in the connection.
  """
  totalCount: Int!
}

type Query {
  posts(
    """
    Apply one or multiple filters to the query.
    Supported filter parameters:
    `id`, `title`, `content`, `user_id`, `published`
    """
    query: String

    """
    Returns up to the first `n` elements from the list.
    """
    first: Int

    """
    Returns up to the last `n` elements from the list.
    """
    last: Int

    """
    Returns the elements that come after the specified cursor.
    """
    after: String

    """
    Returns the elements that come before the specified cursor.
    """
    before: String

    """
    Ordering options for the returned topics.
    """
    orderBy: PostOrder
  ): PostConnection!
}

"""
Ordering options for post connections
"""
input PostOrder {
  """
  The field to order posts by.
  """
  field: PostOrderField!

  """
  The ordering direction.
  """
  direction: OrderDirection!
}

"""
Properties by which post connections can be ordered.
"""
enum PostOrderField {
  ID
  CREATED_AT
}
```

### 完整示例
