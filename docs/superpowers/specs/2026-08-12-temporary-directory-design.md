# Temporary Directory Module Design

## Goal

Add a publishable `@nest-boot/temporary-directory` package, starting at version
`7.0.0`. The package gives NestJS applications request-context-scoped temporary
directories that are removed automatically when the context finishes.

## Public API

The package exports only:

- `TemporaryDirectoryModule`
- `TemporaryDirectoryService`

`TemporaryDirectoryModule` is a static global NestJS module. Consumers import
the class directly:

```ts
@Module({
  imports: [TemporaryDirectoryModule],
})
export class AppModule {}
```

The package has no options interface, `basePath`, `register()`, or
`registerAsync()` API. Request roots always live below the operating system's
temporary directory.

## Package Structure

The package follows the existing `packages/*` conventions:

```text
packages/temporary-directory/
├── src/
│   ├── index.ts
│   ├── temporary-directory.module.ts
│   ├── temporary-directory.service.ts
│   └── *.spec.ts
├── CHANGELOG.md
├── eslint.config.mjs
├── jest.config.ts
├── package.json
├── tsconfig.build.json
└── tsconfig.json
```

The module is a normal NestJS `@Module`; it does not extend a configurable
module class and does not register configuration providers.

## Lifecycle and Data Flow

When Nest constructs the module, it registers a named `RequestContext`
middleware. For each context execution, the middleware:

1. Calls `fsPromises.mkdtempDisposable(join(tmpdir(), "nest-boot-"))` using
   `await using`.
2. Stores the disposable object's `path` in the current `RequestContext` under
   an internal symbol.
3. Runs the remainder of the context middleware chain.
4. Lets asynchronous disposal recursively remove the complete request root
   after the chain resolves or rejects.

Node appends six random characters to the prefix, producing paths such as
`/tmp/nest-boot-aB3xYz`. Creation is atomic and does not reuse an existing
directory, so concurrent contexts receive distinct roots.

`TemporaryDirectoryService.create()` requires an active, initialized
`RequestContext`. It creates and returns a unique `directory-*` child below the
current context root. Multiple calls within one context share the root but never
the child directory. All children are removed when the request-root disposable
leaves scope.

The package targets the repository's Node.js 24 baseline, where
`mkdtempDisposable` is available.

## Cleanup Guarantees and Errors

The `await using` scope disposes the root on normal completion and when the
middleware chain throws. Disposal recursively deletes the directory and its
contents. If deletion fails, Node propagates the disposal error rather than
silently ignoring the failure.

The disposable cannot run after an uncatchable process termination such as
`SIGKILL`, a runtime crash, or power loss. Keeping roots under `tmpdir()` gives
the operating system an additional eventual-cleanup opportunity for those
cases, but does not promise immediate deletion.

The service throws clear errors when:

- no `RequestContext` is active; or
- a context is active but the temporary-directory middleware did not initialize
  its root.

Other filesystem failures are propagated without translation so callers retain
the native error code and path.

## Dependencies and Publishing

The package is named `@nest-boot/temporary-directory`, starts at version
`7.0.0`, and is publicly publishable. It declares the libraries used by its
public NestJS integration as peer dependencies, including
`@nest-boot/request-context`, `@nestjs/common`, `@nestjs/core`,
`reflect-metadata`, and `rxjs`. Workspace versions and test tooling are declared
as development dependencies.

The public entry point exports the module and service. The internal
request-context key is not part of the documented public API.

## Testing

Tests cover:

- the public API exporting only the static module and service;
- request roots being created under `tmpdir()` with the `nest-boot-` prefix;
- distinct roots for concurrent contexts;
- distinct child directories within one context;
- cleanup after successful completion;
- cleanup when the context callback throws;
- rejection outside an active context; and
- rejection when an active context has not been initialized by the module.

Implementation follows red-green-refactor: the static API and disposable
lifecycle tests are observed failing against the current configurable
implementation before production code changes. Final verification runs package
tests, build, lint, TypeDoc, and a package dry run.
