---
"@nest-boot/row-level-security": patch
---

Remove generated RLS bootstrap role SQL and the `app.get_context` helper function.
Generated policies now read transaction-local context values with null-safe
`current_setting` expressions, and the driver clears transaction context with
`RESET LOCAL`.
