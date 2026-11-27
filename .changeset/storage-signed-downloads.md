---
"@nest-boot/storage": minor
---

Add JWT-signed download links and a download route under the application's
global prefix. The route redirects to an S3 presigned URL with the same
expiration deadline and disables caching. Register `JwtModule` to sign and verify
links, or set `download.enabled` to `false` to omit the route.
