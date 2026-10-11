# Contributing to Nest Boot

Thank you for improving Nest Boot. This repository is a pnpm/Turborepo monorepo for the `@nest-boot/*` packages. Contributions should start from a reproducible framework problem or a clearly scoped, broadly useful improvement.

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
pnpm --filter @nest-boot/<package> run
```

Work from an up-to-date `main` on a dedicated branch. Preserve unrelated changes and generated local artifacts; do not reset another contributor's work or push directly to `main`.

## Implement a change

- Add the smallest automated test that fails before the fix and passes after it.
- Fix the closest underlying cause instead of adding a consumer-specific workaround.
- Preserve public API compatibility unless the proposal explicitly discusses a breaking change and migration path.
- Check public exports, types, official docs, peer dependencies, and cross-package consumers when behavior changes.
- Do not manually change package versions, tags, or release artifacts unless the current release workflow or a maintainer explicitly requires it.

Source comments follow `eslint-plugin-jsdoc`'s `flat/recommended-typescript-error` preset. Use `@template` for generic parameters and `{ErrorType}` on `@throws`. Keep parameter and return types in TypeScript, and use `@param` and `@returns` for their descriptions. The shared ESLint config applies the preset without JSDoc rule overrides or legacy tag aliases.

Run focused checks first. Use the package's Vitest script or a Turborepo task:

```bash
pnpm --filter @nest-boot/<package> test
pnpm turbo run test --filter=@nest-boot/<package> --env-mode=loose
pnpm turbo run build --filter=@nest-boot/<package> --force
pnpm turbo run lint --filter=@nest-boot/<package>
```

Do not run both test commands unless useful. Not every package defines every target or contains tests; run only available targets, then add checks for affected dependants and documentation.

## Match pull request CI

The pull request workflow runs:

```bash
pnpm build:packages --force
pnpm format:check
pnpm lint
pnpm test:cov
```

For documentation changes, run `pnpm --filter @nest-boot/docs types:check`, `pnpm --filter @nest-boot/docs lint`, and `pnpm build:docs`. Keep tutorials, examples, and source comments aligned with public API changes.

Coverage tests in CI use PostgreSQL, Redis, and RustFS. If equivalent services are unavailable locally, run the reliable subset and state exactly what was not run. Never claim a check passed without its output.

For package contents or release infrastructure, also consider:

```bash
pnpm --filter @nest-boot/<package> pack --dry-run
pnpm release:status
pnpm test:release
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

## Releases

We use [Changesets](https://changesets.dev/) for independent package versions and
changelogs, [Turborepo](https://turborepo.com/docs) for tasks, and the official
[Changesets GitHub Actions integration](https://changesets.dev/guide/automating)
for version PRs, packing, publishing, tags, and GitHub releases.

### Include a changeset

For a publishable change, run `pnpm changeset`, select the affected public packages
and their patch/minor/major bumps, and describe the user-visible change. Commit the
Markdown file with the code. Conventional Commit titles remain required, but no
longer determine package versions. For changes to tooling, tests, or documentation
that do not require a package release, use `pnpm changeset --empty`.

PR CI reports Changesets status in its job summary. As recommended upstream,
missing changesets do not automatically block every contribution; reviewers check
that publishable changes have the appropriate release entries.

### Stable releases

Develop from `main`. After changesets reach `main`, `release.yml` creates or updates
`chore(release): version packages`. This PR contains the versions, internal
dependency updates, changelogs, and pnpm lockfile for review. Merge it to publish.
The workflow runs the full verification suite, builds with Turborepo, and packs
with Changesets. A separate job publishes those tarballs using npm Trusted
Publishing. Only that job has OIDC permission; build and test jobs cannot publish.

The workflow uses the built-in `GITHUB_TOKEN`. Since bot-created PRs do not trigger
`pull_request` workflows, it explicitly dispatches the existing verification and
PR-title workflows on the version PR branch. No separate personal token is needed.
The repository must allow GitHub Actions to create pull requests.

For a local preview, run `pnpm release:status`. To inspect the complete resulting
files in a disposable checkout, run `pnpm release:version`; this writes versions,
changelogs, and the lockfile, but does not commit, tag, or publish anything.

### Beta releases and graduation

Follow the official [prerelease lifecycle](https://changesets.dev/guide/prereleases).
Before starting a new beta cycle, publish pending stable changes, synchronize
`main` into `beta`, and resolve any version conflicts using the published stable
baseline. In particular, the old v8 beta branch must first receive the stable v8
manifests and this tooling migration; do not enter prerelease mode on its old
prerelease manifests.

On `beta`, run `pnpm changeset pre enter beta`, change `baseBranch` in
`.changeset/config.json` to `beta`, and commit the configuration and generated
`.changeset/pre.json`. Add changesets normally. The same version-PR workflow now
creates beta versions and publishes them to the `beta` npm dist-tag. Unchanged
packages can remain stable; Changesets manages dependent bumps.

To graduate, run `pnpm changeset pre exit`, restore `baseBranch` to `main`, and
include these changes in the PR from `beta` to `main`. Do not delete the archived
changesets in `.changeset/pre`: they describe the stable release. The beta release
workflow intentionally stops once exit is requested. After merging into `main`,
Changesets creates the stable version PR; review and merge it to publish to
`latest`. Synchronize this stable baseline back into `beta` before a new cycle.
The branch guard refuses active prerelease mode on `main`, and refuses beta
publication without an active `beta` prerelease state.

### Recovery and npm authorization

If publication partially fails, use **Re-run failed jobs** on the original Release
run. The publish job reuses its original packed artifacts; already-published npm
versions are not overwritten. A metadata recovery step checks each original
planned version on npm and creates missing GitHub tags/releases at the original
workflow commit. This also repairs a failure after npm succeeded but before
GitHub metadata was created. Existing tags and releases are never overwritten.
Do not start a fresh workflow to repair missing metadata: a fresh npm publish plan
cannot include versions that are already published. Keep the original run's
artifacts available until recovery completes (30-day retention). Never edit an
already published version or add a changeset solely to retry a failed upload.

Existing npm Trusted Publishers continue to use `nest-boot/nest-boot` and workflow
`release.yml`. No workflow rename or npm token is needed. For a new or renamed
package, perform its initial publication with a maintainer account and configure
Trusted Publishing with direct publication enabled before releasing it from CI.
See the [npm documentation](https://docs.npmjs.com/trusted-publishers/).

## Guidance for coding agents

Agents may perform read-only diagnosis, duplicate searches, local implementation, and draft Issue/PR content within the user's requested scope. They must:

- preserve existing worktree changes and use a separate worktree/clone when necessary;
- obtain explicit user authorization before creating an Issue, pushing a branch, or opening a PR;
- avoid public disclosure of security details and all sensitive project data;
- return the Issue/PR URL, head commit SHA, and honest validation results after submission.
