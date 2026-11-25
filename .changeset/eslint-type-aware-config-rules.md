---
"@nest-boot/eslint": patch
"@nest-boot/auth": patch
---

Use TypeScript type information in `nest-boot/graphql/field-config-from-types` and `nest-boot/database/entity-property-config-from-types` so runtime GraphQL scalars (`GraphQLScalarType<T>`), constructors (`Type<T>`, `EntityClass<T>`), enum objects (`enum`, `Record<string, string>`, `as const`, mapped enum records), instantiated MikroORM column types (`new t.bigint("string")`, `new t.decimal(...)`), native `bigint` properties, and JSON-backed heterogeneous union types validate accurately without `eslint-disable` workarounds. Also add explicit `@HideField()` decorators to non-GraphQL credential fields on `Account` and `Session` in `@nest-boot/auth`.
