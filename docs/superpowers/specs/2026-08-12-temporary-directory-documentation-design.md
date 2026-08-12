# Temporary Directory Documentation and Namespace Design

## Goal

Document `@nest-boot/temporary-directory` for npm and the English and Simplified
Chinese documentation sites. At the same time, add optional namespace
directories so applications can group temporary work by purpose without
forcing the generic `directory-` prefix on every allocation.

## Public API

Change the service signature to:

```ts
create(namespace?: string): Promise<string>
```

Calling `create()` creates a random child directly below the request root, such
as `nest-boot-aB3xYz/cD4eF5`. Calling `create("image")` creates the namespace
directory when needed, then creates a random child below it, such as
`nest-boot-aB3xYz/image/cD4eF5`. Concurrent calls within the same namespace use
the same namespace directory but always receive distinct random children.

A namespace is a name, not a path. It must match `/^[A-Za-z0-9_-]+$/` and must
be at most 64 characters long. Therefore empty strings, dots, whitespace,
Unicode characters, separators, absolute paths, and nested paths are rejected
with a `TypeError` before filesystem access. Omitting the argument is the only
way to request an ungrouped directory. This keeps every child within the active
request root. Native filesystem errors continue to propagate unchanged.

Node.js `mkdtemp` appends six random characters directly to its prefix and does
not add a separator. The implementation therefore supplies a trailing platform
separator after the request root or namespace directory. This creates the
random directory inside its intended parent instead of beside it.

The request root is unchanged: `mkdtempDisposable(join(tmpdir(), "nest-boot-"))`
creates one `nest-boot-*` root per request context, and disposal recursively
removes that root and every child when the context resolves or rejects.

## Documentation

Add `packages/temporary-directory/README.md` as a concise English npm landing
page. It contains the feature summary, Node.js `>=24.4.0` requirement,
installation, static module import, `create()` and namespace examples,
cleanup semantics, and links to the complete English and Simplified Chinese
tutorials. Add `README.md` to the package `files` allowlist so it is included in
future npm tarballs.

Add matching documentation-site tutorials:

- `apps/docs/content/docs/tutorial/temporary-directory.mdx`
- `apps/docs/content/docs/tutorial/temporary-directory.zh-Hans.mdx`

Both tutorials cover installation, module import, basic allocation, optional
namespaces, the request-root and namespace directory layout, automatic cleanup
on successful and failed requests, the active `RequestContext` requirement, and
operational best practices. The tutorials are added immediately after
`request-context` in both navigation files because the module builds on that
lifecycle.

The README stays intentionally shorter than the tutorials to avoid maintaining
three full copies of the same material.

## Tests and Verification

Update service tests first to cover:

- ungrouped allocation;
- namespace allocation;
- distinct children under concurrency;
- rejection of empty, overlong, path-like, or otherwise invalid namespaces; and
- cleanup of both ungrouped and namespaced children.

Then update the implementation and API comments. Verify the package test,
lint, and build targets; the documentation-site lint/build targets; internal
documentation links; and `pnpm pack --dry-run` output showing `README.md` in the
published package.

## Release Impact

The optional parameter is backward compatible for callers. Removing the
generic default prefix changes only the returned basename shape, which is an
implementation detail not promised by the original public signature. The
change is suitable for a 7.x minor release together with the new namespace
capability and documentation.
