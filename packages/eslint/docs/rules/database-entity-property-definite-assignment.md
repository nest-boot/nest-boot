# nest-boot/database-entity-property-definite-assignment

📝 Require definite assignment assertions on uninitialized entity properties.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

要求 MikroORM `@Entity()` 实体中无初始值的非可选持久化属性添加确定赋值断言（`!`）。

## Examples

### Incorrect

```ts
import { Entity, Property } from "@mikro-orm/decorators/legacy";

@Entity()
class User {
  @Property()
  name: string;

  @Property({ nullable: true })
  email: string | null;
}
```

### Correct

```ts
import { Entity, Property } from "@mikro-orm/decorators/legacy";

@Entity()
class User {
  @Property()
  name!: string;

  @Property({ nullable: true })
  email!: string | null;

  @Property()
  nickname?: string;

  @Property()
  isActive: boolean = true;
}
```
