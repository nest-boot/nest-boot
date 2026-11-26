# nest-boot/graphql-no-direct-nestjs-import

📝 Require importing GraphQL symbols through the Nest Boot public entry point.

💼 This rule is enabled in the ✅ `recommended` config.

<!-- end auto-generated rule header -->

要求统一通过 `@nest-boot/graphql` 公共入口导入 GraphQL 装饰器、标量与类型，禁止业务包直接从 `@nestjs/graphql` 导入。

## Examples

### Incorrect

```ts
import { Field, ObjectType } from "@nestjs/graphql";
```

### Correct

```ts
import { Field, ObjectType } from "@nest-boot/graphql";
```
