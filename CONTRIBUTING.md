# Contributing to Nest Boot

Thank you for improving Nest Boot. This repository is a pnpm/Nx monorepo for the `@nest-boot/*` packages. Contributions should start from a reproducible framework problem or a clearly scoped, broadly useful improvement.

## Choose the correct repository

- Use this repository for runtime behavior, public APIs and types, generated output, package dependencies, official tutorials/API docs, tests, and release infrastructure.
- Report incorrect or missing agent guidance to [nest-boot/skills](https://github.com/nest-boot/skills).
- Keep application-specific wrappers, directory layouts, deployment rules, and private business behavior in the consuming project.
- Follow [SECURITY.md](SECURITY.md) instead of opening a public Issue for suspected vulnerabilities or sensitive data exposure.

## Before opening an Issue

1. Search open and closed Issues and PRs by package name, symptom, and error message.
2. Confirm the exact `@nest-boot/*` version with the lockfile or `pnpm why`.
3. Check whether the problem still exists on the latest supported release or current `main`.
4. Reduce the report to a sanitized reproduction that separates Nest Boot behavior from application code and upstream dependencies.
5. Include actual and expected behavior, relevant peer dependency versions, and any source/test evidence already found.

Use the Bug form for a reproducible contract violation. Use the Improvement form when the API, compatibility policy, or design still requires discussion. A clear, tested fix may be submitted directly as a PR without creating a duplicate Issue.

## Development setup

The authoritative versions are declared in the root `package.json`. At the time of writing, the repository requires Node.js 26+ and pnpm 10.30.3.

```bash
corepack enable
pnpm install --frozen-lockfile
```

Most `@nest-boot/<name>` packages live in `packages/<name>`. Confirm the project and available targets before running commands:

```bash
pnpm nx show project @nest-boot/<package>
```

Work from an up-to-date `main` on a dedicated branch. Preserve unrelated changes and generated local artifacts; do not reset another contributor's work or push directly to `main`.

## Implement a change

- Add the smallest automated test that fails before the fix and passes after it.
- Fix the closest underlying cause instead of adding a consumer-specific workaround.
- Preserve public API compatibility unless the proposal explicitly discusses a breaking change and migration path.
- Check public exports, types, official docs, peer dependencies, and cross-package consumers when behavior changes.
- Do not manually change package versions, tags, or release artifacts unless the current release workflow or a maintainer explicitly requires it.

Run focused checks first. Use the package's Vitest script or its Nx test target:

```bash
pnpm --filter @nest-boot/<package> test
pnpm nx run @nest-boot/<package>:test --skip-nx-cache
pnpm nx run @nest-boot/<package>:build --skip-nx-cache
pnpm nx run @nest-boot/<package>:lint --skip-nx-cache
```

Do not run both test commands unless useful. Not every package defines every target or contains tests; run only available targets, then add checks for affected dependants and documentation.

## Match pull request CI

The pull request workflow runs:

```bash
pnpm build:packages --skip-nx-cache
pnpm format:check
pnpm lint
pnpm typedoc:check
pnpm test:cov
```

Coverage tests in CI use PostgreSQL, Redis, and MinIO. If equivalent services are unavailable locally, run the reliable subset and state exactly what was not run. Never claim a check passed without its output.

For package contents or release infrastructure, also consider:

```bash
pnpm --filter @nest-boot/<package> pack --dry-run
pnpm release:dry-run
```

Run `git diff --check` and inspect `git status --short` before committing. Do not include `.env` files, caches, build artifacts, coverage output, production data, or unrelated lockfile changes.

## Commits and pull requests

Use Conventional Commit syntax for commits and the PR title. GitHub CI validates the PR title with commitlint. Examples:

- `fix(logger): clear stale request context`
- `feat(middleware): support ordered hooks`
- `docs(graphql): clarify connection filtering`

A pull request should explain:

- the user-visible problem and root cause;
- the smallest implemented solution;
- tests added and every validation command actually run;
- compatibility, dependency, documentation, and expected release impact;
- work intentionally left out or decisions still required.

Link an existing Issue with `Fixes #...` or `Refs #...` when applicable. Do not automatically merge or publish after opening a PR.

## Guidance for coding agents

Agents may perform read-only diagnosis, duplicate searches, local implementation, and draft Issue/PR content within the user's requested scope. They must:

- preserve existing worktree changes and use a separate worktree/clone when necessary;
- obtain explicit user authorization before creating an Issue, pushing a branch, or opening a PR;
- avoid public disclosure of security details and all sensitive project data;
- return the Issue/PR URL, head commit SHA, and honest validation results after submission.
