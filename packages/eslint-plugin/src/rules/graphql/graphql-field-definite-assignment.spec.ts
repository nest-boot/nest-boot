import { tester } from "../../utils/tester";
import rule from "./graphql-field-definite-assignment";

tester.run("graphql-field-definite-assignment", rule, {
  valid: [
    // Property with initializer, no ! needed
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        createdAt: Date = new Date();
      }
    `,
    // Property with !, no initializer
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        name!: string;
      }
    `,
    // Optional property, no ! needed
    /* typescript */ `
      @ObjectType()
      class User {
        @Field()
        age?: number;
      }
    `,
    // InputType class
    /* typescript */ `
      @InputType()
      class CreateUserInput {
        @Field()
        name!: string;
      }
    `,
    // ArgsType class
    /* typescript */ `
      @ArgsType()
      class GetUserArgs {
        @Field()
        id!: string;
      }
    `,
    // Non-GraphQL model class is not checked
    /* typescript */ `
      class NotAGraphQLModel {
        @Field()
        field: string;
      }
    `,
    // Property without @Field decorator is not checked
    /* typescript */ `
      @ObjectType()
      class User {
        field: string;
      }
    `,
  ],
  invalid: [
    // No initializer and no !
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
    // Has initializer but also has !
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
    // InputType - no initializer and no !
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
    // Number type, no initializer and no !
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
