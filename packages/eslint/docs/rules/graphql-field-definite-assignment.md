# nest-boot/graphql-field-definite-assignment

📝 Require definite assignment assertions on uninitialized GraphQL @Field properties.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🧩 `rules`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

要求 `@ObjectType()`、`@InputType()`、`@ArgsType()` 类中带有 `@Field` 且无初始值的非可选属性使用确定赋值断言（`!`）。

## Examples

### Incorrect

```ts
import { Field, ObjectType } from "@nest-boot/graphql";

@ObjectType()
class User {
  @Field(() => String)
  name: string;

  @Field(() => Date)
  createdAt: Date;
}
```

### Correct

```ts
import { Field, ObjectType } from "@nest-boot/graphql";

@ObjectType()
class User {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => Date)
  createdAt: Date = new Date();
}
```
