---
"@nest-boot/graphql-rate-limit": patch
---

Exclude `__typename` from GraphQL request complexity, including when `defaultComplexity` is nonzero. This applies to aliases and to selections at any depth in queries and mutations.
