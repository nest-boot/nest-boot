# Temporary Directory Documentation and Namespace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe optional namespace directories to `TemporaryDirectoryService.create()` and document the package in npm plus the English and Simplified Chinese documentation sites.

**Architecture:** Keep the existing disposable request root unchanged. The service validates an optional namespace, creates that namespace below the active request root when supplied, and passes the selected parent plus a trailing platform separator to `mkdtemp` so Node creates a unique six-character child inside it. A concise English package README links to fuller bilingual tutorials.

**Tech Stack:** TypeScript 5.9, Node.js `fs/promises`, NestJS 11, Jest 29, MDX/Fumadocs, Nx Release.

## Global Constraints

- Keep `TemporaryDirectoryModule` static and global; do not add `register()`, `registerAsync()`, options, or `basePath`.
- Keep request roots under `tmpdir()` with the `nest-boot-` prefix and `mkdtempDisposable` cleanup.
- Expose `create(namespace?: string): Promise<string>`.
- Accept namespaces matching `/^[A-Za-z0-9_-]+$/` with a maximum length of 64 characters.
- Reject supplied empty or invalid namespaces with `TypeError` before filesystem creation.
- Call `mkdtemp` with a trailing platform separator so random children are created inside the root or namespace directory.
- Require Node.js `>=24.4.0` and document the requirement.
- Use Nx Release and Conventional Commits; do not add Changesets.

---

### Task 1: Implement Namespaced Temporary Children

**Files:**

- Modify: `packages/temporary-directory/src/temporary-directory.service.spec.ts`
- Modify: `packages/temporary-directory/src/temporary-directory.service.ts`

**Interfaces:**

- Consumes: the request root stored under `TEMPORARY_DIRECTORY_ROOT` by `TemporaryDirectoryModule`.
- Produces: `TemporaryDirectoryService.create(namespace?: string): Promise<string>`.

- [ ] **Step 1: Write the failing allocation tests**

Replace the generic child assertion with explicit ungrouped and namespaced behavior:

```ts
it("creates ungrouped random children inside the request root", async () => {
  new TemporaryDirectoryModule();

  await RequestContext.run(new RequestContext({ type: "test" }), async () => {
    const [first, second] = await Promise.all([
      service.create(),
      service.create(),
    ]);

    expect(first).not.toBe(second);
    expect(dirname(first)).toBe(dirname(second));
    expect(basename(first)).toHaveLength(6);
    expect(basename(second)).toHaveLength(6);
  });
});

it("creates random children inside a shared namespace", async () => {
  new TemporaryDirectoryModule();

  await RequestContext.run(new RequestContext({ type: "test" }), async () => {
    const [first, second] = await Promise.all([
      service.create("image-cache_2"),
      service.create("image-cache_2"),
    ]);

    expect(first).not.toBe(second);
    expect(dirname(first)).toBe(dirname(second));
    expect(basename(dirname(first))).toBe("image-cache_2");
    expect(basename(first)).toHaveLength(6);
    expect(basename(second)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Write the failing validation tests**

Add a table containing `""`, `"a".repeat(65)`, `"."`, `".."`, `"../image"`, `"foo/bar"`, `"foo\\bar"`, `"image.v2"`, `"图片"`, and `"image cache"`. Within an initialized request context, assert that `service.create(namespace)` rejects with `TypeError` and the message:

```text
Temporary directory namespace must be 1-64 characters using only letters, numbers, hyphens, and underscores
```

- [ ] **Step 3: Extend cleanup coverage for a namespace**

Change the successful cleanup test to call `service.create("audio")`, write a file below the returned child, retain both the child and namespace paths, and assert both paths return `ENOENT` after the request context completes.

- [ ] **Step 4: Run the focused tests and observe RED**

Run:

```bash
pnpm --filter @nest-boot/temporary-directory test --runInBand src/temporary-directory.service.spec.ts
```

Expected: FAIL because `create()` still returns `directory-*` children and ignores/rejects no namespaces.

- [ ] **Step 5: Implement the minimal namespace behavior**

Import `mkdir` and `sep`, define the validation pattern and message, and update `create`:

```ts
const NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const INVALID_NAMESPACE_MESSAGE =
  "Temporary directory namespace must be 1-64 characters using only letters, numbers, hyphens, and underscores";

async create(namespace?: string): Promise<string> {
  if (!RequestContext.isActive()) {
    throw new Error("Temporary directory requires an active RequestContext");
  }

  const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);
  if (!root) {
    throw new Error("Temporary directory context is not initialized");
  }

  if (namespace !== undefined && !NAMESPACE_PATTERN.test(namespace)) {
    throw new TypeError(INVALID_NAMESPACE_MESSAGE);
  }

  const parent = namespace === undefined ? root : join(root, namespace);
  if (namespace !== undefined) {
    await mkdir(parent, { recursive: true });
  }

  return await mkdtemp(`${parent}${sep}`);
}
```

Update the TSDoc to describe the optional namespace and its validation.

- [ ] **Step 6: Run package verification and observe GREEN**

Run:

```bash
pnpm --filter @nest-boot/temporary-directory test --runInBand
pnpm nx run @nest-boot/temporary-directory:lint --skip-nx-cache
pnpm nx run @nest-boot/temporary-directory:build --skip-nx-cache
```

Expected: all temporary-directory suites pass and lint/build exit 0.

- [ ] **Step 7: Commit the API change**

```bash
git add packages/temporary-directory/src/temporary-directory.service.ts packages/temporary-directory/src/temporary-directory.service.spec.ts
git commit -m "feat: add temporary directory namespaces"
```

### Task 2: Add the Package README

**Files:**

- Create: `packages/temporary-directory/README.md`
- Modify: `packages/temporary-directory/package.json`

**Interfaces:**

- Consumes: `TemporaryDirectoryModule` and `TemporaryDirectoryService.create(namespace?: string)` from Task 1.
- Produces: the npm landing page and a tarball allowlist containing `README.md`.

- [ ] **Step 1: Write a concise English README**

Include:

- the package purpose and automatic request-scoped cleanup;
- Node.js `>=24.4.0`;
- `pnpm add @nest-boot/temporary-directory @nest-boot/request-context`;
- direct `TemporaryDirectoryModule` import without registration methods;
- an injectable service example using both `create()` and `create("image")`;
- layout examples `nest-boot-XXXXXX/XXXXXX` and `nest-boot-XXXXXX/image/XXXXXX`;
- the namespace regex and 64-character limit;
- cleanup after both resolved and rejected request contexts, plus the requirement to await work before the request finishes; and
- absolute GitHub links to the English and Simplified Chinese tutorials.

- [ ] **Step 2: Include README in package files**

Add `"README.md"` after `"CHANGELOG.md"` in `packages/temporary-directory/package.json`'s `files` array.

- [ ] **Step 3: Verify formatting and package contents**

Run:

```bash
pnpm exec prettier --check packages/temporary-directory/README.md packages/temporary-directory/package.json
pnpm --filter @nest-boot/temporary-directory pack --dry-run --json
```

Expected: formatting passes and the JSON file list contains `README.md`, `CHANGELOG.md`, `package.json`, and `dist` artifacts.

- [ ] **Step 4: Commit the package documentation**

```bash
git add packages/temporary-directory/README.md packages/temporary-directory/package.json
git commit -m "docs: add temporary directory package README"
```

### Task 3: Add English and Simplified Chinese Tutorials

**Files:**

- Create: `apps/docs/content/docs/tutorial/temporary-directory.mdx`
- Create: `apps/docs/content/docs/tutorial/temporary-directory.zh-Hans.mdx`
- Modify: `apps/docs/content/docs/tutorial/meta.json`
- Modify: `apps/docs/content/docs/tutorial/meta.zh-Hans.json`

**Interfaces:**

- Consumes: the static module and namespaced `create()` behavior from Task 1.
- Produces: `/docs/tutorial/temporary-directory` in both site locales and navigation entries after `request-context`.

- [ ] **Step 1: Add the English tutorial**

Use frontmatter title `Temporary Directory` and a description that mentions request-scoped automatic cleanup. Cover these sections in order: Installation, Requirements, Module Registration, Basic Usage, Namespaces, Directory Layout, Cleanup Lifecycle, Non-HTTP Contexts, Errors, Best Practices, and API Reference. Use executable TypeScript examples with dependency injection and the exact namespace constraints.

- [ ] **Step 2: Add the Simplified Chinese tutorial**

Mirror the English structure and code examples with title `临时目录`. Translate the explanations naturally while preserving API names, regexes, error behavior, and Node.js version exactly.

- [ ] **Step 3: Add both navigation entries**

Insert `"temporary-directory"` immediately after `"request-context"` in both tutorial meta files.

- [ ] **Step 4: Verify tutorial parity and formatting**

Run:

```bash
pnpm exec prettier --check \
  apps/docs/content/docs/tutorial/temporary-directory.mdx \
  apps/docs/content/docs/tutorial/temporary-directory.zh-Hans.mdx \
  apps/docs/content/docs/tutorial/meta.json \
  apps/docs/content/docs/tutorial/meta.zh-Hans.json
pnpm --filter @nest-boot/docs types:check
pnpm nx run @nest-boot/docs:lint --skip-nx-cache
```

Expected: MDX generation/type checking and docs lint exit 0.

- [ ] **Step 5: Commit the tutorials**

```bash
git add apps/docs/content/docs/tutorial/temporary-directory.mdx apps/docs/content/docs/tutorial/temporary-directory.zh-Hans.mdx apps/docs/content/docs/tutorial/meta.json apps/docs/content/docs/tutorial/meta.zh-Hans.json
git commit -m "docs: add temporary directory tutorials"
```

### Task 4: Final CI and Release Verification

**Files:**

- Verify all files changed by Tasks 1-3.

**Interfaces:**

- Consumes: repository Nx targets and the package manifest.
- Produces: evidence that the branch is ready for the existing verify and release workflows.

- [ ] **Step 1: Run changed-package and docs checks without cache**

```bash
pnpm nx run @nest-boot/temporary-directory:test --skip-nx-cache --runInBand
pnpm nx run @nest-boot/temporary-directory:lint --skip-nx-cache
pnpm nx run @nest-boot/temporary-directory:build --skip-nx-cache
pnpm --filter @nest-boot/docs types:check
pnpm nx run @nest-boot/docs:lint --skip-nx-cache
pnpm build:docs --skip-nx-cache
pnpm typedoc:check
```

Expected: every command exits 0.

- [ ] **Step 2: Verify publication metadata and artifact contents**

```bash
pnpm release:dry-run
pnpm --filter @nest-boot/temporary-directory pack --dry-run --json
```

Expected: Nx Release recognizes the `feat` as a 7.x minor change and the package artifact includes `README.md`.

- [ ] **Step 3: Inspect the final diff**

```bash
git diff --check origin/main...HEAD
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors, no uncommitted implementation files, and only the planned design, API, README, and tutorial commits.
