---
"@nest-boot/graphql-rate-limit": patch
---

Return HTTP 429 with the GraphQL error code `TOO_MANY_REQUESTS` when an operation reaches the complexity limit or a client has insufficient points.
