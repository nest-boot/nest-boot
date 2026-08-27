## Summary

- What user-visible problem or framework capability changed?
- Which packages, APIs, types, or official docs are affected?

## Problem and root cause

Describe the sanitized reproduction, broken contract, and evidence supporting the root cause. Link the related Issue when one exists.

## Verification

- [ ] Added or updated a regression/behavior test
- [ ] Ran focused test, build, and lint targets for affected packages
- [ ] Ran `pnpm format:check`
- [ ] Ran `pnpm typedoc:check` when public APIs or docs changed
- [ ] Ran `git diff --check`

List every command and result. Explain any full-CI check that was not run, including unavailable PostgreSQL, Redis, or MinIO services.

## Compatibility and release impact

Describe changes to defaults, public APIs/types, peer dependencies, package contents, migration requirements, and expected release type.

## Checklist

- [ ] PR title follows Conventional Commit syntax
- [ ] Public exports and official docs were reviewed
- [ ] No package versions, tags, or release artifacts were changed unintentionally
- [ ] No `.env`, credentials, customer data, private URLs, production logs, caches, coverage, or unrelated generated files are included
- [ ] The branch targets `main` and does not include unrelated worktree changes
