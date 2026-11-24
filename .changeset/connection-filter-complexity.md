---
"@nest-boot/graphql-connection": minor
"@nest-boot/auth": minor
"@nest-boot/queue-api": minor
"@nest-boot/graphql-rate-limit": patch
---

Connection queries require exactly one of `first` or `last`. Use `after` with `first` or `before` with `last`. This also applies to Auth and job connections. Pass `first: 0` for a query that only selects the existing connection count.

Use `ConnectionBuilder.build().getComplexity` as the resolver field's `complexity` callback to price pagination and normalized filters. The rate limiter supplies resolved field arguments to this callback when calculating actual cost.
