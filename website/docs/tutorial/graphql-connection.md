---
sidebar_position: 2
---

# GraphQL Connection

The `@nest-boot/graphql-connection` module simplifies the implementation of Relay-style cursor-based pagination for GraphQL using MikroORM.

## Installation

```bash
npm install @nest-boot/graphql-connection
# or
pnpm add @nest-boot/graphql-connection
```

## Setup

Register the `GraphQLConnectionModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";

@Module({
  imports: [
    GraphQLConnectionModule.forRoot(),
  ],
})
export class AppModule {}
```

## Usage

### Define Connection Types

Use `ConnectionBuilder` to create connection types for your entities.

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

### Use in Resolver

Inject `ConnectionManager` and use it to find paginated results.

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

The generated connection args support:
- Pagination: `first`, `last`, `after`, `before`
- Sorting: `orderBy` (e.g., `orderBy: { field: NAME, direction: ASC }`)
- Filtering: `filter` (e.g., `filter: { name: { eq: "John" } }`)
- Search: `query` (searches across searchable fields)
