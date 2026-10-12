---
"@nest-boot/command": minor
"@nest-boot/queue": patch
---

Add a type-safe modular command package powered by Clipanion 3, with an `nb` executable loading project `src/cli.ts`, `dist/cli.js`, or `dist/cli.ts` entries. Command providers retain Nest dependency injection, inferred options, help, aliases, exit codes and managed shutdown.

QueueModule registers `nb queue:migrate` using the configured PostgreSQL connection and schema, with an optional `--schema` override. Queue now requires the command package as a peer. Replace standalone queue migration scripts with a dedicated CLI module and run this command before application migrations.
