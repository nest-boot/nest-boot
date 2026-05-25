---
"@nest-boot/eslint-plugin": patch
"@nest-boot/tsconfig": patch
---

Remove inherited `baseUrl` settings from shared TypeScript configuration and package tsconfigs.

This keeps path resolution explicit and avoids package-local aliases being interpreted relative to a shared base config. Existing path aliases are preserved by using explicit relative `paths` entries where needed, including docs collection paths.
