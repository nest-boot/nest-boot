---
"@nest-boot/database": patch
---

Fix VectorType compatibility with MikroORM 7.2 public types so it can be used directly in Property decorators. Preserve vector conversion, null values, and column dimensions.
