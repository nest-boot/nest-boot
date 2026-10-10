# Contributing to Nest Boot

Thank you for improving Nest Boot. This repository is a pnpm/Nx monorepo for the `@nest-boot/*` packages. Contributions should start from a reproducible framework problem or a clearly scoped, broadly useful improvement.

## Choose the correct repository

- Use this repository for runtime behavior, public APIs and types, generated output, package dependencies, official guides and tutorials, tests, and release infrastructure.
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

The authoritative versions are declared in the root `package.json`. At the time of writing, the repository requires Node.js 24.21.0+ and pnpm 10.30.3.

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

Source comments follow `eslint-plugin-jsdoc`'s `flat/recommended-typescript-error` preset. Use `@template` for generic parameters and `{ErrorType}` on `@throws`. Keep parameter and return types in TypeScript, and use `@param` and `@returns` for their descriptions. The shared ESLint config applies the preset without JSDoc rule overrides or legacy tag aliases.

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
pnpm test:cov
```

For documentation changes, run `pnpm --filter @nest-boot/docs types:check`, `pnpm --filter @nest-boot/docs lint`, and `pnpm build:docs`. Keep tutorials, examples, and source comments aligned with public API changes.

Coverage tests in CI use PostgreSQL, Redis, and RustFS. If equivalent services are unavailable locally, run the reliable subset and state exactly what was not run. Never claim a check passed without its output.

For package contents or release infrastructure, also consider:

```bash
pnpm --filter @nest-boot/<package> pack --dry-run
pnpm release:dry-run beta
```

After building packages, run `pnpm test:consumer` to install all public tarballs
and their declared peers in a temporary project outside the workspace. This
check uses strict peer and engine validation without `.pnpmfile.cjs` or repository
overrides. It compiles an application with the published TypeScript preset,
imports package entry points, starts Nest, and checks HTTP request context,
health, password hashing, mail generation, and the published ESLint config.
CI runs it on Node 24.21.0 and the current Node 24 release before permitting release.

Applications extending `@nest-boot/tsconfig` must install its compiler and global
type peers: `typescript@^6`, `@types/node@^24`, and `vitest@^4.1.11`.

Run `git diff --check` and inspect `git status --short` before committing. Do not include `.env` files, caches, build artifacts, coverage output, production data, or unrelated lockfile changes.

## Example end-to-end tests

CI also runs the complete example server E2E suite and the Chromium browser suite:

```bash
pnpm --filter @nest-boot/example-server test:e2e
pnpm --filter @nest-boot/example-client exec playwright install --with-deps chromium
pnpm --filter @nest-boot/example-client test:e2e
```

Both suites require PostgreSQL and Redis. The authentication flows also use Mailpit for SMTP delivery and reading verification messages. Configure `SERVER_E2E_DATABASE_URL`, `SERVER_E2E_REDIS_URL`, and `SERVER_E2E_SMTP_URL`; set `SERVER_E2E_MAILPIT_URL` for the server suite and `CLIENT_E2E_MAILPIT_URL` for the browser suite. The PostgreSQL account must be able to create and drop the temporary databases used by the suites.

Playwright starts its own application servers. Use `CLIENT_E2E_URL` and `SERVER_E2E_URL` with available local ports when the default ports 3100 and 4100 are occupied. CI uploads the HTML report, failure screenshots, and traces as the `playwright-failure` artifact when browser tests fail.

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

## Recover npm publication

### Promote v8 to stable

Before merging `beta` into `main`, run `pnpm release:dry-run main`. This uses the
same package selection and version policy as CI without publishing or writing
release files, commits, or tags.

When `main` contains v8 prerelease manifests, the Release workflow includes every
public prerelease package, even when it has no source changes since the last beta
release. It checks that the corresponding stable versions are unpublished, then
uses Nx's manifest resolver and an explicit `patch` increment to graduate
`8.x.y-beta.n` to `8.x.y`. Nx updates internal dependencies and creates the release
commit and tags. Stable publication refuses any remaining prerelease manifest.
Once all manifests are stable, ordinary `main` releases resume Conventional
Commits versioning. Beta releases continue to use the `beta` npm dist-tag.

Graduation requires every public package to be a v8 prerelease. A mixed stable
and prerelease workspace stops before release commands run: stable packages and
their dependent bumps must not inherit the graduation specifier. Prepare a
consistent prerelease baseline before promoting the release line.

If a stable target already exists on npm, stop and choose a new v8 prerelease
baseline before promotion. Do not overwrite or silently reuse the existing
version. If publication fails after the stable release commit, rerun Release on
`main` with `projects` empty to publish the missing versions without graduating
or incrementing again.

### Retry a publication

The Release workflow versions changed packages and then checks every public package's current version on npm. If publication fails after a release commit is created, run Release again on the latest `beta` or `main` commit with the `projects` input empty. Missing versions are published even when there are no new package changes. Registry authentication or network errors stop the check instead of being treated as missing versions.

For a new or renamed package, publish its built package once with a maintainer account, then configure its npm Trusted Publisher for `nest-boot/nest-boot`, workflow `release.yml`, with direct publishing allowed. The calling workflow is `release.yml`, even though publishing runs inside the reusable `verify.yml` workflow. Existing packages restored under an older name also need their publisher configuration checked.

To validate a newly configured publisher, run Release on `beta` with the package names in the optional comma-separated `projects` input. This explicitly creates another beta version through the normal Nx release process, including affected dependents. npm requires a new trusted publisher to complete its first successful publish within two days. See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Guidance for coding agents

Agents may perform read-only diagnosis, duplicate searches, local implementation, and draft Issue/PR content within the user's requested scope. They must:

- preserve existing worktree changes and use a separate worktree/clone when necessary;
- obtain explicit user authorization before creating an Issue, pushing a branch, or opening a PR;
- avoid public disclosure of security details and all sensitive project data;
- return the Issue/PR URL, head commit SHA, and honest validation results after submission.
