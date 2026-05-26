---
"@nest-boot/tsconfig": patch
---

Add Jest globals to the shared TypeScript base config so package test files resolve `describe`, `it`, and `expect` without local tsconfig overrides.
