---
"@nest-boot/graphql-connection": minor
"@nest-boot/graphql": minor
"@nest-boot/auth": minor
"@nest-boot/queue-api": minor
"@nest-boot/graphql-rate-limit": minor
"@nest-boot/eslint-plugin": minor
"@nest-boot/eslint-config": minor
---

Connection queries require exactly one of `first` or `last`. Use `after` with `first` or `before` with `last`. This also applies to Auth and job connections. Pass `first: 0` for a query that only selects the existing connection count.

Generated Connections provide a default complexity callback for queries and nested fields. The rate limiter reserves one point per requested edge and charges it per resolved edge, including for cursor-only selections. It also prices normalized filters. Invalid pagination reports `BAD_USER_INPUT` on the executed field.

`@nest-boot/graphql`'s `ObjectType` publishes a static `complexity` property as a return type default, including on Connection subclasses. Explicit field costs take precedence. The rate limiter replaces the previous Connection name-suffix rule with schema metadata. Set field complexity explicitly for custom Connections that supply their own pagination cost.

The shared ESLint config enables `@nest-boot/graphql/no-direct-nestjs-import`. Import public GraphQL APIs from `@nest-boot/graphql` so object types register Nest Boot's metadata.
