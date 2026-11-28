---
"@nest-boot/storage": minor
"@nest-boot/storage-graphql": patch
---

Unify object storage, two-stage `tmp/` -> `files/` temporary file uploads, and JWT-signed downloads into `StorageService` in `@nest-boot/storage`, add an opt-in `POST /uploads` dynamic REST upload controller alongside the `/downloads/*` signed download controller, and replace `@nest-boot/staged-upload` and `@nest-boot/staged-upload-graphql` with `@nest-boot/storage` and `@nest-boot/storage-graphql` (`StorageGraphQLModule` / `createTemporaryFileUploadUrls`).
