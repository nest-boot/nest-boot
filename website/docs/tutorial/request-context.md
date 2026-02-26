---
sidebar_position: 3
---

# Request Context

The `@nest-boot/request-context` module provides a way to store and retrieve data scoped to the current execution context (e.g., HTTP request, Queue job) using Node.js `AsyncLocalStorage`.

## Installation

```bash
npm install @nest-boot/request-context
# or
pnpm add @nest-boot/request-context
```

## Setup

Register the `RequestContextModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { RequestContextModule } from "@nest-boot/request-context";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```

## Usage

### Storing and Retrieving Data

```typescript
import { RequestContext } from "@nest-boot/request-context";

// Set data
RequestContext.set("key", "value");

// Get data
const value = RequestContext.get<string>("key");
```

### Accessing Request/Response

For HTTP requests, the Express `Request` and `Response` objects are automatically attached to the context.

```typescript
import { RequestContext, REQUEST } from "@nest-boot/request-context";
import { Request } from "express";

const req = RequestContext.get<Request>(REQUEST);
```

### Creating Contexts

You can manually create a context for background tasks or other async operations.

```typescript
import { RequestContext } from "@nest-boot/request-context";

await RequestContext.run(new RequestContext({ type: "background" }), async () => {
  // Your code here
});
```

Or use the `@CreateRequestContext` decorator.

```typescript
import { CreateRequestContext } from "@nest-boot/request-context";

class MyService {
  @CreateRequestContext()
  async backgroundTask() {
    // Context is available here
  }
}
```
