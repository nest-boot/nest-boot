---
"@nest-boot/request-context": minor
---

Add `RequestContext.withMiddlewareScope()` to isolate middleware registrations during application initialization, execution and shutdown. Existing registrations are inherited, while registrations made inside a scope stay local to that application. CommandFactory uses this scope to prevent sequential or concurrent applications from invoking middleware captured from another application.
