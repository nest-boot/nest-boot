---
"@nest-boot/crypt": minor
"@nest-boot/graphql-connection": minor
"@nest-boot/hash": minor
"@nest-boot/i18n": minor
"@nest-boot/logger": minor
"@nest-boot/mailer": minor
"@nest-boot/redis": minor
"@nest-boot/storage": minor
"@nest-boot/view": minor
---

Align dynamic module static configuration methods with the NestJS community guidelines:

- Mark `I18nModule` and `ViewModule` with `@Global()` directly (removing `isGlobal` registration extras and supporting zero-config direct `I18nModule` imports alongside `ViewModule`).
- Switch global once-per-application infrastructure modules (`CryptModule`, `GraphQLConnectionModule`, `HashModule`, `I18nModule`, `LoggerModule`, `MailerModule`, `RedisModule`, `StorageModule`, and `ViewModule`) from `register` / `registerAsync` to `forRoot` / `forRootAsync`, with optional default `options = {}` on `forRoot()`.
