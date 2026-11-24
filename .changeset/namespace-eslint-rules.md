---
"@nest-boot/eslint-plugin": minor
"@nest-boot/eslint-config": minor
---

Use `@nest-boot/<domain>/<rule>` for every Nest Boot ESLint rule. Move `@nest-boot/entity-property-*` to `@nest-boot/database/entity-property-*` and `@nest-boot/graphql-field-*` to `@nest-boot/graphql/field-*` in rule settings, inline directives, and suppression files.

When upgrading the shared config, upgrade the plugin as well. To use the new IDs in a manual configuration, register the `databasePlugin` and `graphqlPlugin` named exports under `@nest-boot/database` and `@nest-boot/graphql`. The default export continues to support earlier v8 configs and their rule IDs.
