---
"@nest-boot/row-level-security": patch
---

Shorten generated PostgreSQL row-level security policy names before migration diffing to avoid redundant policy recreation when names exceed the identifier length limit.
