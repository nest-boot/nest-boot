---
"@nest-boot/eslint-plugin": major
"@nest-boot/eslint-config": major
---

Remove obsolete import migration rules and the implicit MikroORM import migration
from entity field fixes. Delete custom configuration entries for `import-database`,
`import-graphql`, `import-mikro-orm`, `import-bullmq`, and `import-queue`, including
disabled entries, and migrate import paths and APIs manually.

The shared ESLint config now requires braces around all conditional and loop
bodies with `curly: ["error", "all"]`. Existing violations can be fixed with
`eslint --fix`.
