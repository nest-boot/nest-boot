# Client e2e coverage

Playwright e2e coverage is tracked as functional coverage, not source line
coverage. The matrix lives in `coverage.json` and should be updated whenever a
feature flow is added, changed, or intentionally left uncovered.

Run the report with:

```bash
pnpm --filter @nest-boot/example-client test:e2e:coverage
```

Status meanings:

- `covered`: the current Playwright suite exercises the flow end to end.
- `partial`: part of the flow is exercised, but important variants are missing.
- `missing`: the flow is expected or planned, but no e2e coverage exists yet.

Use `--fail-on-missing` later if CI should block on uncovered functional gaps:

```bash
pnpm --filter @nest-boot/example-client test:e2e:coverage -- --fail-on-missing
```
