import { tester } from "../../utils/tester";
import rule from "./graphql-field-definite-assignment";

tester.run("graphql-field-definite-assignment", rule, {
  valid: [
    // 有初始化值的属性，不需要 !
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        createdAt: Date = new Date();
      }
    `,
    // 有 ! 的属性，没有初始化值
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        name!: string;
      }
    `,
    // 可选属性，不需要 !
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        age?: number;
      }
    `,
    // InputType 类型
    /* typescript */ `
      @InputType()
      class CreateUserInput {
        @Field()
        name!: string;
      }
    `,
    // ArgsType 类型
    /* typescript */ `
      @ArgsType()
      class GetUserArgs {
        @Field()
        id!: string;
      }
    `,
    // 非 GraphQL 模型类不检查
    /* typescript */ `
      class NotAGraphQLModel {
        @Field()
        field: string;
      }
    `,
    // 没有 @Field 装饰器不检查
    /* typescript */ `
      @ObjectType()
      class User {
        field: string;
      }
    `,
  ],
  invalid: [
    // 没有初始化值，也没有 !
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          name: string;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          name!: string;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    // 有初始化值，但也有 !
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          createdAt!: Date = new Date();
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          createdAt: Date = new Date();
        }
      `,
      errors: [{ messageId: "removeDefiniteAssignment" }],
    },
    // InputType - 没有初始化值，也没有 !
    {
      code: /* typescript */ `
        @InputType()
        class CreateUserInput {
          @Field()
          name: string;
        }
      `,
      output: /* typescript */ `
        @InputType()
        class CreateUserInput {
          @Field()
          name!: string;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    // 数字类型，没有初始化值和 !
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          age: number;
        }
      `,
      output: /* typescript */ `
        @ObjectType()
        class User {
          @Field()
          age!: number;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
  ],
});
