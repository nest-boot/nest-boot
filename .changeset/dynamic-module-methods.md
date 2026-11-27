---
"@nest-boot/crypt": minor
"@nest-boot/graphql-connection": minor
"@nest-boot/hash": minor
"@nest-boot/i18n": minor
"@nest-boot/logger": minor
"@nest-boot/mailer": minor
"@nest-boot/redis": minor
"@nest-boot/staged-upload": minor
"@nest-boot/storage": minor
"@nest-boot/view": minor
---

Align dynamic module static configuration methods with the NestJS community guidelines:

- Mark `ViewModule` as `@Global()` by default (removing the `isGlobal` registration extra) so its configured `Liquid` instance is shared across the application like other infrastructure modules.
- Switch global once-per-application infrastructure modules (`CryptModule`, `GraphQLConnectionModule`, `HashModule`, `I18nModule`, `LoggerModule`, `MailerModule`, `RedisModule`, `StagedUploadModule`, `StorageModule`, and `ViewModule`) from `register` / `registerAsync` to `forRoot` / `forRootAsync`, with optional default `options = {}` on `forRoot()`.
