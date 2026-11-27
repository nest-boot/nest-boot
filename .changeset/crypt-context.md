---
"@nest-boot/crypt": minor
"@nest-boot/database-crypt": minor
"@nest-boot/jwt": patch
---

Support optional HKDF `context` domain separation (`CryptOptions`) in `CryptService.encrypt()`, `CryptService.decrypt()`, and `@EncryptedProperty({ context })`, and refactor `@nest-boot/jwt` to encrypt database signing keys via the injected `CryptService` (`{ context: "jwt" }`) instead of a separate `secret` option.
