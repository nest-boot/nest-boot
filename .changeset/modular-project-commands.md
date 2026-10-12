---
---

Introduce `@nest-boot/command` with an initial package version of `8.0.0`. No version bump is needed for its first publication.

Add type-safe modular commands powered by Clipanion 4, with an `nb` executable loading project `src/cli.ts`, `dist/cli.js`, or `dist/cli.ts` entries. CLI entries bootstrap AppModule like main.ts and repl.ts. Command providers retain Nest dependency injection, inferred options, help, aliases, exit codes and managed shutdown.

CommandModule imports RequestContextModule by default. Each command runs with registered context middleware in an independent context of type `command`; custom error handling retains that context. CommandFactory sets process.exitCode internally and closes the application context after execution without exiting the process.
