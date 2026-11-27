# @nest-boot/common

Shared NestJS decorators, metadata constants, and dynamic controller helpers used across Nest Boot packages.

## `@Public()`

```ts
import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
```

Apply `@Public()` to a controller or route handler to mark it as publicly accessible (`IS_PUBLIC_KEY` metadata set to `true`), or `@Public(false)` to override a class-level marker on a specific handler.

## Dynamic Controllers

Use `withDynamicController` (or the lower-level `createDynamicController`) when a module configures a controller's `path` or class `decorators` (including `@Public()`, `@UseGuards()`, `@UseInterceptors()`, `@UsePipes()`, and `@UseFilters()`) dynamically via synchronous or asynchronous module options:

```ts
import { withDynamicController } from "@nest-boot/common";

return withDynamicController(super.forRootAsync(options), WebhookController, {
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: (moduleOptions: WebhookModuleOptions) => ({
    path: moduleOptions.path,
    decorators: moduleOptions.decorators,
  }),
});
```
