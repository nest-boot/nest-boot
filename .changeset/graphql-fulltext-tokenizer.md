---
"@nest-boot/graphql-connection": minor
---

Automatically segment `$fulltext` operands with `@nest-boot/database`'s multilingual `tokenizer` through `mikro-orm-filter-query-schema`'s `operatorTransforms.$fulltext`, after operand validation and before field mapping or replacement callbacks. Query strings, GraphQL filter inputs, and explicit `filterQuerySchema.parse(...)` calls use the same normalization, including logical groups. Preserve native programmatic `args.filter` and `options.where` conditions, other comparison operands, and tokenless full-text constraints.

Declare `@nest-boot/database` as a runtime peer dependency and document using `SearchableProperty` to keep stored and queried word boundaries aligned. Existing search columns should be rebuilt with the same tokenizer when adopting multilingual full-text queries.
