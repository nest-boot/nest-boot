---
"@nest-boot/common": patch
"@nest-boot/jwt": patch
"@nest-boot/auth": minor
---

Move `Public` and `IS_PUBLIC_KEY` into a new `@nest-boot/common` package, and add a standalone `@nest-boot/jwt` module backed by `jose` with mandatory database-backed signing key rotation and a JWKS controller defaulting `jwks.decorators` to `[Public()]`.
