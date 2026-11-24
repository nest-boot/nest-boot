---
"@nest-boot/eslint-plugin": minor
"@nest-boot/eslint-config": minor
---

Use `@nest-boot/<domain>/<rule>` for every Nest Boot ESLint rule. Move `@nest-boot/entity-property-*` to `@nest-boot/database/entity-property-*` and `@nest-boot/graphql-field-*` to `@nest-boot/graphql/field-*` in rule settings, inline directives, and suppression files.

Upgrade the plugin and shared config together. If you register the plugin manually, replace its default import and `@nest-boot` registration with the `databasePlugin` and `graphqlPlugin` named exports under `@nest-boot/database` and `@nest-boot/graphql`.
