---
"@nest-boot/graphql": minor
"@nest-boot/graphql-rate-limit": minor
---

Add 10 points by default to the result cost of each root GraphQL mutation field. Set `mutationComplexity` on `@Mutation` to customize that field's base cost, including zero. Explicit complexity and return type defaults price the result, with selected child fields providing the fallback.
