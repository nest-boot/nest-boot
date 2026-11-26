---
"@nest-boot/graphql-rate-limit": patch
---

Increase the default GraphQL rate-limit bucket capacity to 2,000 points and the restore rate to 100 points per second. Requests whose estimated cost equals the configured maximum can use the available bucket balance.
