---
"@nest-boot/eslint": patch
"@nest-boot/auth": patch
---

Refactor `@nest-boot/eslint` onto the latest standard ESLint plugin toolchain (`@typescript-eslint/utils`, `@typescript-eslint/rule-tester`, `eslint-doc-generator`, and `eslint-plugin-eslint-plugin`), exporting a single standard ESLint v9 plugin object (`{ meta, rules, configs }`), removing custom fixer/decorator/barrel-origin wrappers, and generating verified rule documentation under `docs/rules/`. Also use TypeScript type information in `nest-boot/graphql-field-config-from-types` and `nest-boot/database-entity-property-config-from-types` for custom scalars, constructors, enum objects, instantiated MikroORM column types, `bigint`, and JSON-backed unions, and add explicit `@HideField()` decorators to non-GraphQL credential fields on `Account` and `Session` in `@nest-boot/auth`.
