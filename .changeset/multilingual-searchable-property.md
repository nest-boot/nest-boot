---
"@nest-boot/database": minor
"@nest-boot/eslint-plugin": major
"@nest-boot/eslint-config": patch
---

Add `onFullTextCreate` and `onFullTextUpdate` for native MikroORM full-text properties. Accept a source name or source name array, produce one lowercase segmented string, clear empty values, and preserve targets across unrelated updates. Export `tokenizer` and `whenChanged` for reusable tokenization and dependency guards.

Add `SearchableProperty` as shorthand for `FullTextType`, a full-text index, and both lifecycle handlers. Infer the entity type from the decorated class and check source names without explicit type arguments. Its options exclude the internally managed `type`, `index`, `onCreate`, and `onUpdate` settings.

Adapt entity lint rules to searchable property options, nullable and initializer inference, decorator aliases and namespace imports. Preserve native full-text types and callbacks while removing redundant `Property` and `SearchableProperty` type arguments so the entity type is inferred from its class.

Enable `entity-property-no-spread` to require explicit options in entity field decorators. Report shared configuration spreads without automatically expanding them, and preserve existing spreads when removing redundant native decorator type arguments.

Rename the entity definite-assignment rule to `entity-property-definite-assignment` for consistent entity property naming. Update the rule key in custom ESLint configurations; the shared config uses the new name.

Reject derived updates when a required source property has not been loaded or explicitly assigned, preventing partial entity updates from discarding combined full-text tokens. Preserve the original options object, comments, and quoted keys when only removing a redundant native decorator generic.
