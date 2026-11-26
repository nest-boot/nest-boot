---
"@nest-boot/eslint": minor
---

Split shared ESLint flat configuration presets into `@nest-boot/eslint/app`, `@nest-boot/eslint/library`, and `@nest-boot/eslint/base` subpath exports aligned with `@nest-boot/tsconfig`, and keep the root `@nest-boot/eslint` entry as a standard ESLint v9 plugin where `configs.recommended` enables only the `nest-boot/*` domain rules.
