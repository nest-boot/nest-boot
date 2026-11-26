---
"@nest-boot/graphql-connection": patch
"@nest-boot/auth": patch
---

Charge the base cost of each connection row once. Generated edge nodes, including Auth API-key nodes, have a zero base cost. Child fields and nested objects keep their own costs.
