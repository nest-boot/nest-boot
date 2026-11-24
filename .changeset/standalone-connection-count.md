---
"@nest-boot/graphql-connection": minor
"@nest-boot/auth": minor
"@nest-boot/queue-api": minor
---

Move counts out of paginated connections. Connection types now return `edges` and `pageInfo`; `totalCount`, `totalCountRelation`, and the count-selection `info` option have been removed. Auth and Queue API connections follow the same contract.

Define a separate count field with `Count`, the connection's generated `CountArgs`, and `ConnectionManager.count`. Reuse the list's scope and filter inputs. The result reports `EXACT` for up to 10,000 matches and `AT_LEAST` above that threshold. Attach `getCountComplexity` to the field to charge 10 base points plus the same filter costs as a list.
