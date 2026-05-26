---
"@nest-boot/row-level-security": patch
---

Wrap raw `using` and `withCheck` policy expressions when generating PostgreSQL policy SQL so values like `true` produce valid predicates.
