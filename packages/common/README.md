# @nest-boot/common

Shared NestJS decorators and metadata constants used across Nest Boot packages.

```ts
import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
```

Apply `@Public()` to a controller or route handler to mark it as publicly accessible (`IS_PUBLIC_KEY` metadata set to `true`), or `@Public(false)` to override a class-level marker on a specific handler.
