---
"@nest-boot/row-level-security": patch
---

Remove generated RLS bootstrap role SQL and the `app.get_context` helper function.
Generated policies now read transaction-local context values with missing-ok
`current_setting` casts, and the driver clears transaction context with
transaction-local `set_config(..., null, true)` calls.
