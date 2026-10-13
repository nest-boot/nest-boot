---
"@nest-boot/request-context": minor
---

Export a request-scoped RequestContext provider from RequestContextModule for constructor injection. Resolve the already active context and propagate request scope through dependent providers, preserving isolation between concurrent contexts. Entry points must establish RequestContext before resolving scoped dependencies; interceptor-only fallbacks continue to use static accessors inside handlers.
