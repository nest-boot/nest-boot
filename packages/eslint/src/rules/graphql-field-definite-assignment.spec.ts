import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./graphql-field-definite-assignment.js";

const ruleTester = new RuleTester();

ruleTester.run("graphql-field-definite-assignment", rule, {
  valid: [
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        createdAt: Date = new Date();
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        name!: string;
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        age?: number;
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User extends BaseUser {
        @Field()
        declare name: string;
      }
    `,
    /* typescript */ `
      @InputType()
      class CreateUserInput {
        @Field()
        name!: string;
      }
    `,
    /* typescript */ `
      @ArgsType()
      class GetUserArgs {
        @Field()
        id!: string;
      }
    `,
    /* typescript */ `
      class NotAGraphQLModel {
        @Field()
        field: string;
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User {
        @Audit
        field: string;
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User {
        method() {
          return "value";
        }
      }
    `,
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        ["name"]: string;
      }
    `,
  ],
  invalid: [
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
    {
      code: /* typescript */ `
        import { InputType as Model, Field as GqlField } from "@nest-boot/graphql";
        @Model()
        class CreateUserInput {
          @GqlField()
          name: string;
        }
      `,
      output: /* typescript */ `
        import { InputType as Model, Field as GqlField } from "@nest-boot/graphql";
        @Model()
        class CreateUserInput {
          @GqlField()
          name!: string;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
  ],
});
