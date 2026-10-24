---
"@nest-boot/database": patch
---

Fix VectorType compatibility with MikroORM 7.2 public types by implementing the custom type directly and removing the pgvector Node.js dependency. Preserve null and undefined values and property-level dimension precedence. Reject empty vectors, non-finite numbers, malformed vector text, and invalid dimensions before sending them to the database. The PostgreSQL vector extension is still required.
