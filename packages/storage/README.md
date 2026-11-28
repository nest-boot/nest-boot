# @nest-boot/storage

`StorageModule` provides a unified global `StorageService` for S3-compatible object storage in NestJS applications.

## Fixed directory layout & unified `uploadFileFromUrl`

To keep bucket layouts predictable, all write and upload operations manage keys automatically under two fixed directories beneath optional `rootPath`:

- `tmp/<uuid>.<ext>`: temporary uploads (`createTemporaryFileUploadUrl`, `uploadTemporaryFile`)
- `files/YYYY/MM/DD/<uuid>.<ext>`: permanent business files (`uploadFileFromUrl`, `uploadFile`)

`createTemporaryFileUploadUrl` returns `{ url, resourceUrl, fields }`. Once the client uploads to `url` with `fields`, `resourceUrl` is a temporary readable URL (supporting previews even on private buckets). Pass either `resourceUrl` or an external HTTP/HTTPS URL to `uploadFileFromUrl(url)`:

- **Staged `tmp/` URLs**: promoted via zero-bandwidth S3 `CopyObject` without deleting the `tmp/` source.
- **External HTTP/HTTPS URLs**: streamed directly into S3 via `@aws-sdk/lib-storage` `Upload` (zero local disk staging) with SSRF private-IP protection (configurable via `ssrf: { enabled?, allowedHosts? }` in `StorageModuleOptions`). All server-side `upload*` methods honor `upload.timeout` (default `30_000` ms, overridable per call via `options.timeout`).

Enable `upload.enabled: true` to mount the built-in REST endpoint (`POST /uploads` by default), or install `@nest-boot/storage-graphql` and import `StorageGraphQLModule` to expose the `createTemporaryFileUploadUrls` GraphQL mutation. When `upload.limits` is omitted, `DEFAULT_STORAGE_UPLOAD_LIMITS` enforces safe presets across both `createTemporaryFileUploadUrl` and `uploadFileFromUrl` (raster images 10 MiB, PDF/Office/text/CSV/JSON 25 MiB, audio 50 MiB, video 100 MiB, archives 100 MiB; blocking HTML/SVG/scripts by default).

## Signed downloads

When `JwtModule` from `@nest-boot/jwt` is registered, `StorageModule` mounts `/downloads/*` (with `download.decorators` defaulting to `[Public()]`) and signs download links via `createFileDownloadUrl(key, { subject })`.
