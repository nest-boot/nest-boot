---
"@nest-boot/tsconfig": patch
---

Configure `tsBuildInfoFile` in the `base` and `library` presets so TypeScript writes incremental build info files to the project root instead of `dist/`.
