# nest-boot/database-entity-property-config-from-types

📝 Enforce @Property and @Enum decorator configuration from TypeScript types and require Opt<T> on initialized properties.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

以 TypeScript 属性类型作为唯一事实来源，自动生成或对齐 MikroORM `@Entity()` 实体上的 `@Property`、`@PrimaryKey`、`@Enum`、`@SearchableProperty` 配置，并要求带有非空默认值的属性使用 `Opt<T>` 包装。

## 设计意图

TypeScript 类型在编译后完全擦除，`reflect-metadata` 无法保留联合类型、数组元素类型与可空性。本规则在 Lint 阶段把 TS 属性类型确定性地同步到 MikroORM 运行时装饰器上，防止 TS 类型与数据库列类型或 `NOT NULL` 约束发生静默漂移，同时支持通过 `eslint --fix` 自动补齐装饰器与运行时导入。

## Examples

### Incorrect

```ts
import { Entity, Property } from "@mikro-orm/decorators/legacy";

enum Role {
  Admin = "admin",
  User = "user",
}

@Entity()
class User {
  name!: string;

  @Property({ type: t.string })
  bio?: string;

  @Property()
  role!: Role;

  @Property({ type: t.boolean })
  isActive: boolean = true;
}
```

### Correct

```ts
import { type Opt, t } from "@mikro-orm/core";
import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";

enum Role {
  Admin = "admin",
  User = "user",
}

@Entity()
class User {
  @Property({ type: t.string })
  name!: string;

  @Property({ type: t.text, nullable: true })
  bio?: string;

  @Enum({ items: () => Role })
  role!: Role;

  @Property({ type: t.boolean })
  isActive: Opt<boolean> = true;
}
```
