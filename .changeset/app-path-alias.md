---
"@nest-boot/tsconfig": minor
"@nest-boot/command": minor
"@nest-boot/graphql": patch
---

Add the `@/*` path alias (`${configDir}/src/*`) to `@nest-boot/tsconfig/app.json`, resolve configured TypeScript `paths` aliases during `nb` source execution in `@nest-boot/command`, and preserve reflected `@Field()` complexity defaults when merged with untyped `@ResolveField()` handlers in `@nestjs/graphql` 14.2+.
