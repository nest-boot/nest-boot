---
"@nest-boot/database": minor
"@nest-boot/auth": minor
---

Expose getDatabaseConfig() as the named database configuration loader, retaining loadConfigFromEnv as a deprecated compatibility alias. Add withAuthDatabaseConfig(config) to register built-in Auth entities for runtime and CLI discovery without manual array construction. The helpers preserve application configuration, return new objects and deduplicate entity registrations. Compose them with Queue's withQueueDatabaseConfig and reuse the configuration factory in DatabaseModule.forRootAsync; the example no longer needs any casts.
