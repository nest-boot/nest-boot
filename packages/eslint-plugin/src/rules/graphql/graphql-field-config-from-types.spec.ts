import { tester } from "../../utils/tester";
import rule from "./graphql-field-config-from-types";

tester.run("graphql-field-config-from-types", rule, {
  valid: [
    // 正确的 string 类型
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        name!: string;
      }
    `,
    // 正确的 number 类型（Float）
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Float)
        score!: number;
      }
    `,
    // 正确的 number 类型（Int）
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Int)
        age!: number;
      }
    `,
    // 正确的 boolean 类型
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Boolean)
        isActive!: boolean;
      }
    `,
    // 正确的 nullable 配置
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String, { nullable: true })
        name?: string;
      }
    `,
    // 正确的数组类型
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => [String])
        tags!: string[];
      }
    `,
    // ID 类型
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => ID)
        id!: string;
      }
    `,
    // 自定义类型
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Profile)
        profile!: Profile;
      }
    `,
    // 带有 HideField 装饰器的属性不需要 @Field
    /* typescript */ `
      @ObjectType()
      class User {
        @HideField()
        password!: string;
      }
    `,
    // 非 GraphQL 模型类不检查
    /* typescript */ `
      class NotAGraphQLModel {
        field: string;
      }
    `,
    // 复杂的配置对象（包含展开运算符和条件表达式）
    /* typescript */ `
      @ObjectType()
      class Connection {
        @Field(() => String, {
          nullable: true,
          ...(filterableFields.length > 0
            ? {
                description: \`Apply filters.\`,
              }
            : {}),
        })
        query?: string;
      }
    `,
  ],
  invalid: [
    // @Field 类型不匹配
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => Int)
          name!: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          name!: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // nullable 配置不匹配
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          name?: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // 不应该有 nullable 但设置了
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true })
          name!: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          name!: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // 数组类型不匹配
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          tags!: string[];
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => [String])
          tags!: string[];
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // 缺少 type function 但有其他配置选项（应保留）
    {
      code: /* typescript */ `
        @ObjectType()
        class PageInfo {
          @Field({
            complexity: 0,
            description: "Whether there are any pages prior to the current page.",
          })
          hasPreviousPage!: boolean;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class PageInfo {
          @Field(() => Boolean, { complexity: 0, description: "Whether there are any pages prior to the current page." })
          hasPreviousPage!: boolean;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // 配置 nullable 时保留其他选项
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { description: "User name" })
          name?: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true, description: "User name" })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // 复杂配置对象（包含展开运算符）缺少 type function
    {
      code: /* typescript */ `
        @ObjectType()
        class Connection {
          @Field({
            nullable: true,
            ...(filterableFields.length > 0
              ? {
                  description: \`Apply filters.\`,
                }
              : {}),
          })
          query?: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class Connection {
          @Field(() => String, { nullable: true, ...(filterableFields.length > 0
              ? {
                  description: \`Apply filters.\`,
                }
              : {}) })
          query?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
  ],
});
