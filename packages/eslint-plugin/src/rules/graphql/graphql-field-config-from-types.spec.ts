import { tester } from "../../utils/tester";
import rule from "./graphql-field-config-from-types";

tester.run("graphql-field-config-from-types", rule, {
  valid: [
    // Correct string type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        name!: string;
      }
    `,
    // Correct number type (Float)
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Float)
        score!: number;
      }
    `,
    // Correct number type (Int)
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Int)
        age!: number;
      }
    `,
    // Correct boolean type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Boolean)
        isActive!: boolean;
      }
    `,
    // Correct nullable configuration
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String, { nullable: true })
        name?: string;
      }
    `,
    // Correct array type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => [String])
        tags!: string[];
      }
    `,
    // ID type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => ID)
        id!: string;
      }
    `,
    // Custom type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Profile)
        profile!: Profile;
      }
    `,
    // Property with @HideField decorator does not need @Field
    /* typescript */ `
      @ObjectType()
      class User {
        @HideField()
        password!: string;
      }
    `,
    // Non-GraphQL model class is not checked
    /* typescript */ `
      class NotAGraphQLModel {
        field: string;
      }
    `,
    // Complex config object (with spread operator and conditional expression)
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
    // @Field type mismatch
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
    // nullable configuration mismatch
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
    // Should not have nullable but it is set
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
    // Array type mismatch
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
    // Missing type function but has other config options (should be preserved)
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
    // nullable config should preserve other options
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
    // Complex config object (with spread operator) missing type function
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
