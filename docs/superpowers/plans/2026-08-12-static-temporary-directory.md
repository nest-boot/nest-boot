# Static Temporary Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the configurable temporary-directory module with a static module whose request roots are created and cleaned up by Node.js `mkdtempDisposable`.

**Architecture:** A static global NestJS module registers one `RequestContext` middleware. The middleware creates an async-disposable root with `mkdtempDisposable(join(tmpdir(), "nest-boot-"))`, stores its path in the current context, and uses `await using` to dispose the entire root after success or failure; the existing service continues to allocate unique children below that root.

**Tech Stack:** TypeScript 5.9, Node.js 24 `node:fs/promises`, NestJS 11, `@nest-boot/request-context`, Jest, Nx, pnpm.

## Global Constraints

- The package remains `@nest-boot/temporary-directory` version `7.0.0`.
- The public API exports only `TemporaryDirectoryModule` and `TemporaryDirectoryService`.
- The module is static and has no `basePath`, options interface, `register()`, or `registerAsync()` API.
- Every request root uses `mkdtempDisposable(join(tmpdir(), "nest-boot-"))` with `await using`.
- Node appends a unique six-character suffix; root basenames therefore match `nest-boot-.{6}` and concurrent contexts must receive different paths.
- `TemporaryDirectoryService.create(): Promise<string>` remains unchanged and creates unique `directory-*` children under the active request root.
- Cleanup must cover normal completion and thrown callbacks; native creation and disposal errors remain observable.
- The repository Node.js floor remains Node 24.

---

## File Map

- Modify `packages/temporary-directory/src/index.spec.ts`: assert the static-only public API.
- Modify `packages/temporary-directory/src/index.ts`: export only the module and service.
- Modify `packages/temporary-directory/src/temporary-directory.module.spec.ts`: cover the system temporary root, collision-resistant suffix, and cleanup.
- Modify `packages/temporary-directory/src/temporary-directory.module.ts`: become a static module and use `mkdtempDisposable` with `await using`.
- Keep `packages/temporary-directory/src/temporary-directory.constants.ts`: internal request-context storage key.
- Keep `packages/temporary-directory/src/temporary-directory.service.ts`: child-directory allocator.
- Keep `packages/temporary-directory/src/temporary-directory.service.spec.ts`: service isolation and cleanup coverage.
- Delete `packages/temporary-directory/src/temporary-directory.module-definition.ts`: configurable-module builder is no longer used.
- Delete `packages/temporary-directory/src/temporary-directory-module-options.interface.ts`: the module has no options.
- Delete `packages/temporary-directory/src/resolve-base-path.ts`: roots always use `tmpdir()`.
- Delete `packages/temporary-directory/src/resolve-base-path.spec.ts`: base-path behavior no longer exists.
- Modify `packages/temporary-directory/CHANGELOG.md`: describe the static disposable lifecycle in the initial release.

### Task 1: Remove the Configurable Public API

**Files:**

- Modify: `packages/temporary-directory/src/index.spec.ts`
- Modify: `packages/temporary-directory/src/index.ts`
- Modify: `packages/temporary-directory/src/temporary-directory.module.spec.ts`
- Modify: `packages/temporary-directory/src/temporary-directory.module.ts`
- Delete: `packages/temporary-directory/src/temporary-directory.module-definition.ts`
- Delete: `packages/temporary-directory/src/temporary-directory-module-options.interface.ts`
- Delete: `packages/temporary-directory/src/resolve-base-path.ts`
- Delete: `packages/temporary-directory/src/resolve-base-path.spec.ts`

**Interfaces:**

- Consumes: NestJS `@Global()`, `@Module()`, `RequestContext.registerMiddleware`, `tmpdir()`, `randomUUID()`, `mkdir()`, and `rm()` as the temporary intermediate implementation.
- Produces: static `TemporaryDirectoryModule` with no dynamic registration methods; root lifecycle behavior remains unchanged until Task 2.

- [ ] **Step 1: Write the failing static-API test**

Replace `packages/temporary-directory/src/index.spec.ts` with:

```ts
import { TemporaryDirectoryModule, TemporaryDirectoryService } from ".";

describe("temporary-directory public API", () => {
  it("exports the static module and service", () => {
    expect(TemporaryDirectoryModule).toBeDefined();
    expect(TemporaryDirectoryService).toBeDefined();
    expect(TemporaryDirectoryModule).not.toHaveProperty("register");
    expect(TemporaryDirectoryModule).not.toHaveProperty("registerAsync");
  });
});
```

This catches accidental retention of either configurable-module entry point.

- [ ] **Step 2: Run the public-API test and verify RED**

Run:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache -- --runInBand src/index.spec.ts
```

Expected: FAIL because `TemporaryDirectoryModule` still owns `register` and `registerAsync`.

- [ ] **Step 3: Reduce module lifecycle tests to static imports**

In `temporary-directory.module.spec.ts`:

- remove `DynamicModule`, `Type`, fixture-directory helpers, and all custom-base-path cases;
- make `compile()` always import `TemporaryDirectoryModule`;
- retain the system-temp, successful-cleanup, and thrown-callback tests;
- keep the UUID assertion temporarily so this task isolates only the API change.

The intermediate system-temp test remains:

```ts
it("uses the system temporary directory", async () => {
  await compile();

  await RequestContext.run(new RequestContext({ type: "test" }), async () => {
    const root = requireRoot();
    expect(dirname(root)).toBe(tmpdir());
    expect(basename(root)).toMatch(
      /^nest-boot-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await expect(stat(root)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 4: Implement the minimal static module**

Change `TemporaryDirectoryModule` to a plain class without configurable-module imports, inheritance, or injected options. Keep the current manual lifecycle temporarily, fixed to `tmpdir()`:

```ts
@Global()
@Module({
  providers: [TemporaryDirectoryService],
  exports: [TemporaryDirectoryService],
})
export class TemporaryDirectoryModule {
  constructor() {
    RequestContext.registerMiddleware(
      "temporary-directory",
      async (context, next) => {
        const root = join(tmpdir(), `nest-boot-${randomUUID()}`);
        await mkdir(root);
        context.set(TEMPORARY_DIRECTORY_ROOT, root);

        try {
          return await next();
        } finally {
          await rm(root, { force: true, recursive: true });
        }
      },
    );
  }
}
```

Delete the four obsolete configuration/base-path files and remove the options export from `index.ts`:

```ts
export * from "./temporary-directory.module";
export * from "./temporary-directory.service";
```

- [ ] **Step 5: Run the package tests and verify GREEN**

Run:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache -- --runInBand
```

Expected: all package tests PASS, with the existing UUID lifecycle still in place.

- [ ] **Step 6: Commit the static API**

```bash
git add packages/temporary-directory/src
git commit -m "refactor: make temporary directory module static"
```

### Task 2: Adopt Node Async-Disposable Request Roots

**Files:**

- Modify: `packages/temporary-directory/src/temporary-directory.module.spec.ts`
- Modify: `packages/temporary-directory/src/temporary-directory.module.ts`
- Verify: `packages/temporary-directory/src/temporary-directory.service.spec.ts`

**Interfaces:**

- Consumes: `mkdtempDisposable(prefix: PathLike): Promise<DisposableTempDir>`, `tmpdir(): string`, `join(...paths: string[]): string`, and `RequestContext` middleware.
- Produces: roots created atomically with prefix `join(tmpdir(), "nest-boot-")`, exposed as `temporaryDirectory.path`, and recursively removed by `[Symbol.asyncDispose]` when the middleware callback leaves scope.

- [ ] **Step 1: Write the failing Node-suffix test**

Change the system-temp assertion in `temporary-directory.module.spec.ts` to:

```ts
expect(dirname(root)).toBe(tmpdir());
expect(basename(root)).toMatch(/^nest-boot-.{6}$/);
```

The production change that makes this test pass is replacing UUID construction with Node's atomic `mkdtempDisposable` suffix generation.

- [ ] **Step 2: Run the module test and verify RED**

Run:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache -- --runInBand src/temporary-directory.module.spec.ts
```

Expected: FAIL because the current root has a UUID suffix rather than exactly six alphanumeric characters. Existing success/error cleanup cases should still pass.

- [ ] **Step 3: Implement `mkdtempDisposable` with `await using`**

Replace the middleware body and filesystem imports in `temporary-directory.module.ts`:

```ts
import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ...

RequestContext.registerMiddleware(
  "temporary-directory",
  async (context, next) => {
    await using temporaryDirectory = await mkdtempDisposable(
      join(tmpdir(), "nest-boot-"),
    );
    context.set(TEMPORARY_DIRECTORY_ROOT, temporaryDirectory.path);
    return await next();
  },
);
```

Remove `randomUUID`, `mkdir`, `rm`, manual `try/finally`, and explicit root construction. Do not call `temporaryDirectory.remove()` manually because scope disposal owns cleanup.

- [ ] **Step 4: Run package tests and verify GREEN**

Run:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache -- --runInBand
```

Expected: all module and service tests PASS. In particular, both thrown-callback tests must observe the original callback error and all captured paths must be absent after the context completes.

- [ ] **Step 5: Run the uncached build**

Run:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:build --skip-nx-cache
```

Expected: PASS, proving TypeScript 5.9 downlevels `await using` for the package's CommonJS/ES2021 output and Node 24 types provide `mkdtempDisposable`.

- [ ] **Step 6: Commit disposable lifecycle**

```bash
git add packages/temporary-directory/src/temporary-directory.module.ts packages/temporary-directory/src/temporary-directory.module.spec.ts
git commit -m "refactor: dispose request temporary roots"
```

### Task 3: Document and Verify the Publishable Package

**Files:**

- Modify: `packages/temporary-directory/CHANGELOG.md`
- Verify: `packages/temporary-directory/package.json`
- Verify: `packages/temporary-directory/tsconfig.build.json`
- Verify: `typedoc.json`
- Verify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: completed static module and disposable lifecycle.
- Produces: release documentation and fresh test/build/lint/docs/package evidence for `@nest-boot/temporary-directory@7.0.0`.

- [ ] **Step 1: Update the initial changelog entry**

Set the 7.0.0 change to:

```md
- Add static request-context-scoped temporary directories backed by Node.js async disposal and automatic cleanup.
```

- [ ] **Step 2: Confirm obsolete configuration artifacts are absent**

Run:

```bash
rg -n "basePath|registerAsync|ConfigurableModuleBuilder|resolveBasePath" packages/temporary-directory
```

Expected: exit 1 with no matches. This is an implementation-scope audit, not a behavior test.

- [ ] **Step 3: Run fresh package verification**

Run each command with Node 24.15.0:

```bash
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache -- --runInBand
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:build --skip-nx-cache
fnm exec --using=24.15.0 -- pnpm nx run @nest-boot/temporary-directory:lint --skip-nx-cache
fnm exec --using=24.15.0 -- pnpm typedoc:check
```

Expected: all commands exit 0, all package tests pass, and TypeDoc includes `packages/temporary-directory` without warnings.

- [ ] **Step 4: Inspect the publishable tarball**

Run from `packages/temporary-directory`:

```bash
fnm exec --using=24.15.0 -- pnpm pack --dry-run
```

Expected: package name/version are `@nest-boot/temporary-directory@7.0.0`; the tarball contains `CHANGELOG.md`, `package.json`, and `dist` JavaScript/declarations, with no `.spec.*` files.

- [ ] **Step 5: Run repository hygiene checks**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended changelog change is uncommitted before the final commit.

- [ ] **Step 6: Commit the release documentation**

```bash
git add packages/temporary-directory/CHANGELOG.md
git commit -m "docs: describe disposable temporary directories"
```

- [ ] **Step 7: Review the final branch delta**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- packages/temporary-directory typedoc.json pnpm-lock.yaml
git status --short
```

Expected: the package is static, has no configuration artifacts, uses `mkdtempDisposable` with `await using`, keeps the existing service contract, and the worktree is clean.
