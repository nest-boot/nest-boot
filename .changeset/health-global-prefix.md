---
"@nest-boot/health-check": major
---

Register the health endpoint at `/health` and let NestJS apply the application's global prefix. With `app.setGlobalPrefix("api")`, the endpoint is `/api/health` without duplicating `api`.

Applications without a global prefix must update their probe URL from `/api/health` to `/health`, or configure the `api` global prefix. Remove previous `api/health` global prefix exclusions; exclude `health` instead when the endpoint should remain outside the global prefix.
