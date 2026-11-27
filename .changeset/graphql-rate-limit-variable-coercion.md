---
"@nest-boot/graphql-rate-limit": patch
---

Defer unresolved operations and invalid operation variables to Apollo Server before complexity points are reserved, preserving `BAD_USER_INPUT` and HTTP 400 responses.
