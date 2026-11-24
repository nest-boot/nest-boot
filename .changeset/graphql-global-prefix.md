---
"@nest-boot/graphql": major
---

Default to `path: "/graphql"` and `useGlobalPrefix: true`, delegating route prefixing to the official NestJS GraphQL driver. Applications with the `api` global prefix continue to serve `/api/graphql`; applications without a global prefix now serve `/graphql`.

To preserve the previous fixed endpoint, explicitly configure `{ path: "/api/graphql", useGlobalPrefix: false }`. Both defaults remain overridable in synchronous and asynchronous registration.
