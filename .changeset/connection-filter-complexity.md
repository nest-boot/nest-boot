---
"@nest-boot/graphql-connection": minor
"@nest-boot/graphql": minor
"@nest-boot/auth": minor
"@nest-boot/queue-api": minor
"@nest-boot/graphql-rate-limit": minor
"@nest-boot/eslint-plugin": minor
"@nest-boot/eslint-config": minor
---

Connection queries require exactly one of `first` or `last`, with a page size from 1 to 100. Use `after` with `first` or `before` with `last`. This also applies to Auth and job connections.

Generated Connections provide a default complexity callback for queries and nested fields. The rate limiter reserves one point per requested edge and charges it per resolved edge, including for cursor-only selections. It also prices normalized filters. Invalid pagination reports `BAD_USER_INPUT` on the executed field.

With Nest Boot's `GraphQLModule`, its `Query`, `Mutation`, `ResolveField`, and `Field` decorators use a return type's static `complexity` as a field default, including on Connection subclasses. Explicit field costs take precedence. Set field complexity explicitly for custom Connections that supply their own pagination cost.

The `connectionComplexity` export has been removed from `@nest-boot/graphql-rate-limit`. Use the generated `Connection.complexity` or provide a field-level `complexity` callback for custom pagination.

Complexity callbacks receive `resolved.result` during settlement. The Nest Boot GraphQL decorators and `defineComplexity` infer the result using the same rule as NestJS's `@Field` default value.

The shared ESLint config enables `@nest-boot/graphql/no-direct-nestjs-import`. Import public GraphQL APIs from `@nest-boot/graphql` to use the field decorators that register default complexity.
