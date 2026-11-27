# @nest-boot/storage

`StorageModule` provides S3-compatible object storage for NestJS.

## Signed downloads

The signed download route is enabled by default in `StorageModule`.
`@nest-boot/jwt` is a peer dependency. Import `JwtModule` (or
`JwtModule.forRoot()` / `JwtModule.forRootAsync()`) to enable signing and
verification. Without JWT registration, storage operations remain available and
the download route is not mounted.

```ts
import { StorageModule } from "@nest-boot/storage";

StorageModule.forRoot({ download: { baseURL: "https://api.example.com" } });
```

Authorize access in your application before calling
`StorageDownloadService.createUrl(key, subject)`. The generated URL points to
`/files/*` under the app's Nest global prefix (honoring prefix exclusions and
remaining version-neutral when URI or header versioning is enabled). Set
`download.path` to use a different static route, such as `/media/download`. Add
only the route path in this option. Nest supplies the global prefix, and the
module appends the object key. Links are root-relative by default. Set
`download.baseURL` to generate absolute links. The handler verifies the
download token, storage bucket/root namespace, and object key, then redirects
to an S3 presigned URL with the same expiration deadline. Both responses use
`Cache-Control: no-store`.

Tokens last one hour by default. Use `download.expiresIn` to set the lifetime in
seconds. `download.decorators` defaults to `[Public()]` from `@nest-boot/common`
so global authentication guards allow signed download requests automatically;
pass additional class decorators (for example `[Public(), SkipThrottle()]` or
`UseGuards(...)` / `UseInterceptors(...)`) when needed. Use
`download.resolveContentType` to override the S3 content type or return `null`
to disallow an object key.

To omit the route, set `download.enabled` to `false` in the options passed to
`forRoot()` or returned by the `forRootAsync()` factory.

```ts
StorageModule.forRootAsync({
  useFactory: () => ({ download: { enabled: false } }),
});
```
