import { tester } from "../../utils/tester.js";
import rule from "./graphql-field-config-from-types.js";

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
    // Configured decorators can be ignored
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Internal()
          @Field(() => String)
          token!: string;
        }
      `,
      options: [
        {
          decorators: {
            Internal: "ignore" as const,
          },
        },
      ],
    },
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
    // Methods are ignored
    /* typescript */ `
      @ObjectType()
      class User {
        method() {
          return "value";
        }
      }
    `,
    // Properties with no usable type information are skipped
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        settings = {};
      }
    `,
    // Computed property names fall back to normal type inference
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        ["name"]!: string;
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
    // Missing @Field decorator should infer scalar type from the property type
    {
      code: /* typescript */ `@ObjectType()
class User {
  name!: string;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => String)
  name!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Missing @Field decorator should add required ID import
    {
      code: /* typescript */ `@ObjectType()
class User {
  id!: string;
}`,
      output: /* typescript */ `import { ID } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => ID)
  id!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Existing scalar imports should be reused
    {
      code: /* typescript */ `import { ID } from "@nestjs/graphql";
@ObjectType()
class User {
  ownerID!: string;
}`,
      output: /* typescript */ `import { ID } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => ID)
  ownerID!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Record types should use GraphQLJSONObject and add its import
    {
      code: /* typescript */ `@ObjectType()
class User {
  @Field(() => String)
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  @Field(() => GraphQLJSONObject)
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Existing GraphQLJSONObject imports should be reused
    {
      code: /* typescript */ `import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  @Field(() => GraphQLJSONObject)
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Ref<T | null> should unwrap the type and mark the field nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  friend!: Ref<User | null>;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => User, { nullable: true })
  friend!: Ref<User | null>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Ref<T | undefined> should also mark the field nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  friend!: Ref<User | undefined>;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => User, { nullable: true })
  friend!: Ref<User | undefined>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Union types without nullish members use the first concrete type
    {
      code: /* typescript */ `@ObjectType()
class User {
  value!: string | number;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => String)
  value!: string | number;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Undefined unions should be nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  nickname!: string | undefined;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => String, { nullable: true })
  nickname!: string | undefined;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Array<T> should be emitted as a GraphQL array type
    {
      code: /* typescript */ `@ObjectType()
class User {
  tags!: Array<string>;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => [String])
  tags!: Array<string>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Bare Array references should still be handled as identifier types
    {
      code: /* typescript */ `@ObjectType()
class User {
  values!: Array;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => Array)
  values!: Array;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Literal initializers should be used when no type annotation exists
    {
      code: /* typescript */ `@ObjectType()
class User {
  published = true;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => Boolean)
  published = true;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Number literal initializers should infer Float
    {
      code: /* typescript */ `import { Float } from "@nestjs/graphql";
@ObjectType()
class User {
  score = 1;
}`,
      output: /* typescript */ `import { Float } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => Float)
  score = 1;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // String literal initializers should infer String
    {
      code: /* typescript */ `@ObjectType()
class User {
  title = "hello";
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @Field(() => String)
  title = "hello";
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Relation decorators configured for removal should remove @Field
    {
      code: /* typescript */ `@ObjectType()
class User {
  @HideField()
  @Field(() => String)
  password!: string;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @HideField()
  password!: string;
}`,
      errors: [{ messageId: "removeFieldDecorator" }],
    },
  ],
});
