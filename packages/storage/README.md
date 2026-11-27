# @nest-boot/storage

`StorageModule` provides S3-compatible object storage for NestJS.

## Signed downloads

The signed download route is enabled by default in `StorageModule`.
`@nest-boot/jwt` is a peer dependency. Add `JwtModule.forRoot()` or
`JwtModule.forRootAsync()` to enable signing and verification. Without JWT
registration, storage operations remain available and download requests return 404.

```ts
import { StorageModule } from "@nest-boot/storage";

StorageModule.register({ download: { baseURL: "https://api.example.com" } });
```

Authorize access in your application before calling
`StorageDownloadService.createUrl(key, subject)`. The generated URL points to
`/files/*` under the app's Nest global prefix. Set `download.path`
to use a different static route, such as `/media/download`. Add only the
route path in this option. Nest supplies the global prefix, and the module
appends the object key. Links are root-relative by default. Set
`download.baseURL` to generate absolute links. The handler verifies the
download token and object key, then redirects to an S3 presigned URL with the
same expiration deadline. Both responses use `Cache-Control: no-store`.

Tokens last one hour by default. Use `download.expiresIn` to set the lifetime in
seconds. Hosts with a global authentication guard can supply their public
route decorator with `download.controllerDecorator`. Use `download.resolveContentType` to
override the S3 content type or return `null` to disallow an object key.

To omit the route, set `download.enabled` to `false` in the options passed to
`register()` or returned by the `registerAsync()` factory.

```ts
StorageModule.registerAsync({
  useFactory: () => ({ download: { enabled: false } }),
});
```
