# @nest-boot/eslint

## 8.1.0

### Minor Changes

- 5c2a6bf: Connection queries require exactly one of `first` or `last`, with a page size from 1 to 100. Use `after` with `first` or `before` with `last`. This also applies to Auth and job connections.
  
  Generated Connections provide a default complexity callback for queries and nested fields. The rate limiter reserves one point per requested edge and charges it per resolved edge, including for cursor-only selections. It also prices normalized filters. Invalid pagination reports `BAD_USER_INPUT` on the executed field.
  
  With Nest Boot's `GraphQLModule`, its `Query`, `Mutation`, `ResolveField`, and `Field` decorators use a return type's static `complexity` as a field default, including on Connection subclasses. Explicit field costs take precedence. Set field complexity explicitly for custom Connections that supply their own pagination cost.
  
  The `connectionComplexity` export has been removed from `@nest-boot/graphql-rate-limit`. Use the generated `Connection.complexity` or provide a field-level `complexity` callback for custom pagination.
  
  Complexity callbacks receive `resolved.result` during settlement. The Nest Boot GraphQL decorators and `defineComplexity` infer the result using the same rule as NestJS's `@Field` default value.
  
  The shared ESLint config enables `nest-boot/graphql-no-direct-nestjs-import`. Import public GraphQL APIs from `@nest-boot/graphql` to use the field decorators that register default complexity.
- 266f018: Split shared ESLint flat configuration presets into `@nest-boot/eslint/app` and `@nest-boot/eslint/library` subpath exports aligned with `@nest-boot/tsconfig`, and keep the root `@nest-boot/eslint` entry as a standard ESLint v9 plugin where `configs.recommended` enables only the `nest-boot/*` domain rules.
- e964374: Merge `@nest-boot/eslint-config` and `@nest-boot/eslint-plugin` into `@nest-boot/eslint`. Use `@nest-boot/eslint/app` or `@nest-boot/eslint/library` for the full shared flat configuration presets, or the root `@nest-boot/eslint` plugin export (`configs.recommended`) for Nest Boot custom rules only.
- 98dca9a: Use `nest-boot/<domain>-<rule>` for every Nest Boot ESLint rule. Move `@nest-boot/entity-property-*` to `nest-boot/database-entity-property-*`, `@nest-boot/graphql-field-*` to `nest-boot/graphql-field-*`, and `@nest-boot/queue/processor-name` to `nest-boot/queue-processor-name` in rule settings, inline directives, and suppression files.
  
  To configure rules manually in a flat configuration, register the default export from `@nest-boot/eslint` under `"nest-boot"` (or spread `configs.recommended`).

### Patch Changes

- 361f26f: Refactor `@nest-boot/eslint` onto the latest standard ESLint plugin toolchain (`@typescript-eslint/utils`, `@typescript-eslint/rule-tester`, `eslint-doc-generator`, and `eslint-plugin-eslint-plugin`), exporting a single standard ESLint v9 plugin object (`{ meta, rules, configs }`), removing custom fixer/decorator/barrel-origin wrappers, and generating verified rule documentation under `docs/rules/`. Also use TypeScript type information in `nest-boot/graphql-field-config-from-types` and `nest-boot/database-entity-property-config-from-types` for custom scalars, constructors, enum objects, instantiated MikroORM column types, `bigint`, and JSON-backed unions, and add explicit `@HideField()` decorators to non-GraphQL credential fields on `Account` and `Session` in `@nest-boot/auth`.
