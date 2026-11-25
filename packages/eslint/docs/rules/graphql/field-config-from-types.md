# nest-boot/graphql/field-config-from-types

📝 Enforce @Field decorator type and nullable configuration from TypeScript types.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🧩 `rules`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

以 TypeScript 属性类型作为唯一事实来源，自动生成或修正 `@ObjectType()`、`@InputType()`、`@ArgsType()` 类上的 `@Field` 返回类型回调与 `nullable` 配置（含列表元素可空性 `items` / `itemsAndList`），并强制显式声明 `@HideField()` 等排除边界。

## Options

<!-- begin auto-generated rule options list -->

| Name         | Description                                                                                                                                                                                             | Type   | Default           |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- | :---------------- |
| `decorators` | Configure behavior for each decorator. ignore: skip checks; remove: remove @Field. Default: { HideField: 'remove', OneToOne: 'remove', OneToMany: 'remove', ManyToOne: 'remove', ManyToMany: 'remove' } | Object | `[object Object]` |

<!-- end auto-generated rule options list -->

可以通过 `decorators` 选项自定义特定装饰器的处理策略（`"remove"` 自动移除多余的 `@Field`，`"ignore"` 跳过该属性检查）。

## Examples

### Incorrect

```ts
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

@ObjectType()
class User {
  id!: string;

  @Field(() => String)
  nickname?: string;

  @Field(() => [String])
  tags!: (string | null)[];

  @HideField()
  @Field(() => String)
  passwordHash!: string;
}
```

### Correct

```ts
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";

@ObjectType()
class User {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  nickname?: string;

  @Field(() => [String], { nullable: "items" })
  tags!: (string | null)[];

  @HideField()
  passwordHash!: string;
}
```
