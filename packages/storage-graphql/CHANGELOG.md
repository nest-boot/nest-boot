# @nest-boot/storage-graphql

## 8.0.1

### Patch Changes

- dc8fece: Unify object storage, two-stage `tmp/` -> `files/` temporary file uploads, and JWT-signed downloads into `StorageService` in `@nest-boot/storage`, add an opt-in `POST /uploads` dynamic REST upload controller alongside the `/downloads/*` signed download controller, and replace `@nest-boot/staged-upload` and `@nest-boot/staged-upload-graphql` with `@nest-boot/storage` and `@nest-boot/storage-graphql` (`StorageGraphQLModule` / `createTemporaryFileUploadUrls`).
- Updated dependencies [3f52d8a]
- Updated dependencies [5c2a6bf]
- Updated dependencies [4c9ae88]
- Updated dependencies [ec31b0c]
- Updated dependencies [043a007]
- Updated dependencies [79d781a]
- Updated dependencies [dc8fece]
- Updated dependencies [e8efb52]
  - @nest-boot/graphql@8.1.0
  - @nest-boot/storage@8.1.0
