# Changesets

Run `pnpm changeset` for changes that should be published. Select the affected
public packages, their semantic version bumps, and write a user-facing summary.
Commit the generated Markdown file with the code. Tooling-only changes can use
`pnpm changeset --empty`.

The Release workflow opens a version PR. Merge that PR to publish the reviewed
versions after verification. See [CONTRIBUTING.md](../CONTRIBUTING.md#releases)
for prereleases, recovery, and Trusted Publishing setup.

Official guides: [Changesets](https://changesets.dev/),
[GitHub Actions](https://changesets.dev/guide/automating), and
[prereleases](https://changesets.dev/guide/prereleases).
