---
"@nest-boot/storage": minor
---

Add JWT-signed download links at `/storage/download/*` under the application's
global prefix. Set `download.path` to customize the route and generated links.
The route redirects to an S3 presigned URL with the same
expiration deadline and disables caching. Register `JwtModule` to sign and verify
links, or set `download.enabled` to `false` to omit the route.
