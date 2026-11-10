---
"@nest-boot/database": minor
"@nest-boot/auth": minor
"@nest-boot/queue-api": patch
---

Add built-in `nb database:*` commands for database creation, migrations, schema management, and seeders. Commands use the application's initialized ORM, return CLI exit codes, and close resources through CommandFactory. Schema create/update/drop print SQL unless `--run` is supplied.

Enable module entity auto-loading by default and add `DatabaseModule.forFeatureAsync` for configuration-dependent entity registration before ORM initialization. Include migration and seeder extensions in framework defaults. The database package now requires `@nest-boot/command`.

AuthModule automatically registers its existing entities with DatabaseModule, including asynchronous module options. Remove `withAuthDatabaseConfig` and use the application CLI module graph for database commands. Auth now requires the DatabaseModule integration. QueueApiModule automatically registers its Job history entity. Move custom standalone MikroORM configuration into DatabaseModule; the example removes its config file and switches migration/seeder scripts to `nb`.
