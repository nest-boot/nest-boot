# nest-boot/database/entity-property-no-spread

📝 Require explicit options in entity field decorators.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🧩 `rules`.

<!-- end auto-generated rule header -->

要求 MikroORM 实体字段装饰器显式列出每一项配置，禁止通过对象展开（`...shared`）隐式混入配置。

## Examples

### Incorrect

```ts
import { Property } from "@mikro-orm/decorators/legacy";

const shared = { hidden: true };

class User {
  @Property({ ...shared, nullable: true })
  passwordHash!: string | null;
}
```

### Correct

```ts
import { Property } from "@mikro-orm/decorators/legacy";

class User {
  @Property({ hidden: true, nullable: true })
  passwordHash!: string | null;
}
```
