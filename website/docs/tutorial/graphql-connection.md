---
sidebar_position: 6
---

# GraphQL Connection Module

The `@nest-boot/graphql-connection` module provides cursor-based pagination for GraphQL APIs following the [Relay Connection specification](https://relay.dev/graphql/connections.htm). It integrates with MikroORM to generate type-safe, paginated queries with filtering, sorting, and search capabilities.

## Installation

```bash
npm install @nest-boot/graphql-connection @nest-boot/graphql @mikro-orm/core
# or
pnpm add @nest-boot/graphql-connection @nest-boot/graphql @mikro-orm/core
```

## Basic Usage

### Module Registration

Register the `GraphQLConnectionModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";

@Module({
  imports: [GraphQLConnectionModule.register()],
})
export class AppModule {}
```

The module is global, so you only need to import it once.

### Building Connection Types

Use `ConnectionBuilder` to generate all necessary GraphQL types for an entity:

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

### Using in Resolvers

Inject `ConnectionManager` to execute paginated queries:

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

## Pagination

The module supports both forward and backward pagination.

### Forward Pagination

Use `first` and `after` for forward pagination:

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

### Backward Pagination

Use `last` and `before` for backward pagination:

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

## Filtering

### MongoDB-Style Filter

The `filter` argument accepts MongoDB query syntax:

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

Supported operators:

- `$eq`, `$ne` - Equality
- `$gt`, `$gte`, `$lt`, `$lte` - Comparison
- `$in`, `$nin` - Array membership
- `$and`, `$or` - Logical operators
- `$regex` - Regular expression (string fields)

### Search Query

The `query` argument provides a simpler search syntax:

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

Search syntax supports:

- Plain text search across searchable fields
- Field-specific filters: `field:value`
- Quoted strings: `"exact phrase"`
- Negation: `-term` or `field:-value`

## Ordering

Use the `orderBy` argument to sort results:

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

## Field Configuration

### Field Types

Configure fields with appropriate types:

```typescript
new ConnectionBuilder(User)
  .addField({ field: "name", type: "string" })
  .addField({ field: "age", type: "number" })
  .addField({ field: "isActive", type: "boolean" })
  .addField({ field: "createdAt", type: "date" })
  .build();
```

### Field Options

Each field can have the following options:

```typescript
.addField({
  field: "name",        // Entity property name
  type: "string",       // Field type
  filterable: true,     // Include in filter (default: true)
  searchable: true,     // Include in text search
  sortable: true,       // Allow sorting by this field
})
```

### Replacement Fields

For nested or computed fields, use replacement:

```typescript
.addField({
  field: "authorName",
  type: "string",
  replacement: "author.name",  // Maps to nested property
  filterable: true,
})
```

## Additional Filters

Add server-side filters in the resolver:

```typescript
@Query(() => UserConnection)
async activeUsers(@Args() args: UserConnectionArgs): Promise<UserConnection> {
  return this.connectionManager.find(UserConnection, args, {
    where: { isActive: true, deletedAt: null },
  });
}
```

## Filter Options

Configure filter complexity limits:

```typescript
new ConnectionBuilder(User, {
  filter: {
    maxDepth: 5, // Maximum nesting depth
    maxConditions: 20, // Maximum number of conditions
    maxOrBranches: 5, // Maximum $or branches
    maxArrayLength: 100, // Maximum array length for $in
  },
})
  .addField({ field: "name", type: "string" })
  .build();
```

## Example: Complete Setup

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

## API Reference

See the complete [API documentation](/docs/api/@nest-boot/graphql-connection) for detailed information.

## Features

- **Relay Compliant** - Follows the Relay Connection specification
- **Type-Safe** - Fully typed with TypeScript generics
- **MikroORM Integration** - Works seamlessly with MikroORM entities
- **MongoDB-Style Filtering** - Powerful filter syntax with validation
- **Search Syntax** - Human-friendly search query parsing
- **Cursor-Based Pagination** - Stable pagination with opaque cursors
- **Configurable Limits** - Prevent abuse with complexity limits
