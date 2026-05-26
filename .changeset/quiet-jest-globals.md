---
"@nest-boot/tsconfig": patch
---

Add Jest and Node globals to the shared TypeScript base config so package test files resolve `describe`, `it`, `expect`, and Node APIs without local tsconfig overrides.
