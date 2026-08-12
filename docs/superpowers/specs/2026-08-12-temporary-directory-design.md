# Temporary Directory Module Design

## Goal

Add a publishable `@nest-boot/temporary-directory` package, starting at version
`7.0.0`. The package gives NestJS applications request-context-scoped temporary
directories that are removed automatically when the context finishes.

## Public API

The package exports:

- `TemporaryDirectoryModule`
- `TemporaryDirectoryService`
- `TemporaryDirectoryModuleOptions`

`TemporaryDirectoryModuleOptions` contains one optional property:

```ts
interface TemporaryDirectoryModuleOptions {
  basePath?: string;
}
```

The module supports all three import forms:

```ts
TemporaryDirectoryModule;

TemporaryDirectoryModule.register({
  basePath: "/var/tmp/my-app",
});

TemporaryDirectoryModule.registerAsync({
  useFactory: () => ({
    basePath: process.env.TEMPORARY_DIRECTORY_BASE_PATH,
  }),
});
```

Direct static import and dynamic registration with an omitted or empty
`basePath` use `node:os`'s `tmpdir()` result. An absolute custom path is used as
given. A relative custom path is resolved from `process.cwd()`. Module
configuration is trusted developer-provided application configuration, not user
input.

## Package Structure

The package follows the existing `packages/*` conventions:

```text
packages/temporary-directory/
├── src/
│   ├── index.ts
│   ├── temporary-directory.module-definition.ts
│   ├── temporary-directory.module.ts
│   ├── temporary-directory.service.ts
│   ├── temporary-directory-module-options.interface.ts
│   └── *.spec.ts
├── CHANGELOG.md
├── eslint.config.mjs
├── jest.config.ts
├── package.json
├── tsconfig.build.json
└── tsconfig.json
```

The module definition uses NestJS `ConfigurableModuleBuilder` and exposes the
generated `register` and `registerAsync` methods through explicit overrides,
matching the other configurable Nest Boot packages. The module options provider
is optional so importing `TemporaryDirectoryModule` directly remains valid.

## Lifecycle and Data Flow

When Nest constructs the module, it registers a named `RequestContext`
middleware. For each context execution, the middleware:

1. Resolves the configured base path, falling back to `tmpdir()`.
2. Creates the base path recursively when needed.
3. Creates a unique `nest-boot-${randomUUID()}` directory below the base path.
4. Stores that root path in the current `RequestContext` under an internal
   symbol.
5. Runs the remainder of the context middleware chain.
6. Removes the entire context root in a `finally` block after the chain resolves
   or rejects.

`TemporaryDirectoryService.create()` requires an active, initialized
`RequestContext`. It creates and returns a unique `directory-*` child below the
current context root. Multiple calls within one context share the root but never
the child directory. Concurrent contexts use different roots.

The request root uses `randomUUID()` rather than a generic temporary-directory
suffix so filesystem entries are recognizable as Nest Boot-owned. Cleanup uses
Node's recursive filesystem removal in a `finally` block. The package targets
the repository's Node.js 24 baseline.

## Errors

The service throws clear errors when:

- no `RequestContext` is active; or
- a context is active but the temporary-directory middleware did not initialize
  its root.

Filesystem failures from resolving, creating, using, or removing directories
are propagated without translation so callers retain the native error code and
path.

The configured `basePath` is a caller-owned container and is never deleted by
the package. Only uniquely named `nest-boot-${randomUUID()}` roots created by
the package and their contents are disposed. This makes cleanup safe for the
system temporary directory and for shared custom base paths alike.

## Dependencies and Publishing

The package is named `@nest-boot/temporary-directory`, starts at version
`7.0.0`, and is publicly publishable. It declares the libraries used by its
public NestJS integration as peer dependencies, including
`@nest-boot/request-context`, `@nestjs/common`, `@nestjs/core`,
`reflect-metadata`, and `rxjs`. Workspace versions and test tooling are declared
as development dependencies.

The public entry point exports the module, service, and options interface. The
internal request-context key and generated module-definition tokens are not part
of the documented public API.

## Testing

Tests cover:

- static module import using the system temporary directory;
- `register()` with default, empty, absolute, and relative `basePath` values;
- `registerAsync()` resolving its factory-provided configuration;
- distinct child directories within one context;
- isolated roots for concurrent contexts;
- cleanup after successful completion;
- cleanup when the context callback throws;
- rejection outside an active context; and
- rejection when an active context has not been initialized by the module.

Implementation follows red-green-refactor: each behavior test is observed
failing before the minimum corresponding production code is added. Final
verification runs the package tests, build, and lint checks.
