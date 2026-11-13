---
"@nest-boot/graphql-connection": minor
---

Automatically segment `$fulltext` operands with `@nest-boot/database`'s multilingual `tokenizer` before executing connection queries and counts. Apply the same normalization to query strings, structured filters, and programmatic filters, including logical groups and relation conditions. Preserve other comparison operands and keep tokenless full-text conditions so they cannot broaden a search.

Declare `@nest-boot/database` as a runtime peer dependency and document using `SearchableProperty` to keep stored and queried word boundaries aligned. Existing search columns should be rebuilt with the same tokenizer when adopting multilingual full-text queries.
