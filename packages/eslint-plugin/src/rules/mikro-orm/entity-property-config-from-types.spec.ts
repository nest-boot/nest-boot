import { tester } from "../../utils/tester";
import rule from "./entity-property-config-from-types";

tester.run("entity-property-config-from-types", rule, {
  valid: [
    // Correct string type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.string })
        name!: string;
      }
    `,
    // Correct nullable configuration
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.string, nullable: true })
        name?: string;
      }
    `,
    // Using Opt<T> type with initializer
    /* typescript */ `
      import { Entity, Property, Opt } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive: Opt<boolean> = false;
      }
    `,
    // Relation decorators don't need @Property
    /* typescript */ `
      import { Entity, ManyToOne } from "@mikro-orm/core";

      @Entity()
      class Post {
        @ManyToOne()
        author!: User;
      }
    `,
    // PrimaryKey needs type configuration
    /* typescript */ `
      import { Entity, PrimaryKey, t } from "@mikro-orm/core";

      @Entity()
      class User {
        @PrimaryKey({ type: t.integer })
        id!: number;
      }
    `,
    // Enum type uses @Enum
    /* typescript */ `
      import { Entity, Enum } from "@mikro-orm/core";

      enum Role {
        Admin,
        User
      }

      @Entity()
      class User {
        @Enum({ items: () => Role })
        role!: Role;
      }
    `,
    // Array type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.array })
        tags!: number[];
      }
    `,
    // boolean type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive!: boolean;
      }
    `,
    // Date type using t.datetime
    /* typescript */ `
      import { Entity, Property, Opt } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.datetime, defaultRaw: 'now()' })
        createdAt: Opt<Date> = new Date();
      }
    `,
    // Date type using t.date (valid Date type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.date })
        birthDate!: Date;
      }
    `,
    // Date type using t.time (valid Date type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.time })
        workTime!: Date;
      }
    `,
    // Using t.text instead of t.string (valid string type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.text })
        description!: string;
      }
    `,
    // Decimal and BigInt string storage are valid string configurations
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: new BigIntType('string') })
        externalId!: string;
      }
    `,
    // Decimal and BigInt number storage are valid number configurations
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: new DecimalType('number') })
        score!: number;
      }
    `,
    // VectorType is valid for number arrays
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: new VectorType(3) })
        embedding!: number[];
      }
    `,
    // VectorType class reference is valid for number arrays
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: VectorType })
        embedding!: number[];
      }
    `,
    // Capitalized primitive wrapper names are supported
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.string })
        name!: String;

        @Property({ type: t.float })
        score!: Number;

        @Property({ type: t.boolean })
        active!: Boolean;
      }
    `,
    // DecimalType class reference is valid for strings
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: DecimalType })
        amount!: string;
      }
    `,
    // BigIntType class reference is valid for numbers
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: BigIntType })
        amount!: number;
      }
    `,
    // GraphQLJSONObject identifier maps to JSON
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.json })
        payload!: GraphQLJSONObject;
      }
    `,
    // Custom type arrays use t.json
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      class Profile {}

      @Entity()
      class User {
        @Property({ type: t.json })
        profiles!: Profile[];
      }
    `,
    // Collection<T> is skipped
    /* typescript */ `
      import { Collection, Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property()
        posts!: Collection<Post>;
      }
    `,
    // Methods are ignored
    /* typescript */ `
      import { Entity } from "@mikro-orm/core";

      @Entity()
      class User {
        method() {
          return "value";
        }
      }
    `,
    // Non-Entity class is not checked
    /* typescript */ `
      class NotAnEntity {
        field: string;
      }
    `,
  ],
  invalid: [
    // type configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.float })
          name!: string;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.string })
          name!: string;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // nullable configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.string })
          name?: string;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.string, nullable: true })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Has initializer but not using Opt<T>
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          isActive: boolean = false;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property, Opt } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          isActive: Opt<boolean> = false;
        }
      `,
      errors: [{ messageId: "useOptTypeForInitializedProperty" }],
    },
    // Enum type should use @Enum decorator
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Property()
          role!: Role;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property, Enum } from "@mikro-orm/core";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role })
          role!: Role;
        }
      `,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // @Enum nullable configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Enum } from "@mikro-orm/core";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role })
          role?: Role;
        }
      `,
      output: /* typescript */ `
        import { Entity, Enum } from "@mikro-orm/core";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role, nullable: true })
          role?: Role;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Array type configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.string })
          tags!: number[];
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.array })
          tags!: number[];
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Empty @Property() should add type: t.boolean
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property()
          published!: boolean;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          published!: boolean;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Empty @Property() should add type: t.datetime (Date type)
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property()
          createdAt!: Date;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.datetime })
          createdAt!: Date;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Date type with wrong configuration should be fixed to t.datetime
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.string })
          createdAt!: Date;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/core";

        @Entity()
        class User {
          @Property({ type: t.datetime })
          createdAt!: Date;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Missing @Property decorator should add one from the TypeScript type
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/core";
@Entity()
class User {
  name!: string;
}`,
      output: /* typescript */ `import { Entity } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Record types should use t.json
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.json })
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Union types without nullish members use the first concrete type
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  value!: string | number;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  value!: string | number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Undefined unions should be nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  nickname!: string | undefined;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string, nullable: true })
  nickname!: string | undefined;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Ref<T | null> should unwrap the type and preserve nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  owner!: Ref<User | null>;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ nullable: true })
  owner!: Ref<User | null>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Ref<T | undefined> should unwrap the type and preserve nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  owner!: Ref<User | undefined>;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ nullable: true })
  owner!: Ref<User | undefined>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // PrimaryKey number fields should default to t.integer when missing
    {
      code: /* typescript */ `import { Entity, PrimaryKey } from "@mikro-orm/core";
@Entity()
class User {
  @PrimaryKey()
  id!: number;
}`,
      output: /* typescript */ `import { Entity, PrimaryKey } from "@mikro-orm/core";
@Entity()
class User {
  @PrimaryKey({ type: t.integer })
  id!: number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Custom property-like decorators should keep their decorator name
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/core";
@Entity()
class User {
  @EncryptedProperty({ type: t.float, length: 255 })
  secret!: string;
}`,
      output: /* typescript */ `import { Entity } from "@mikro-orm/core";
@Entity()
class User {
  @EncryptedProperty({ type: t.string, length: 255 })
  secret!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Custom class types should remove unnecessary type config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
class Profile {}
@Entity()
class User {
  @Property({ type: t.string })
  profile!: Profile;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
class Profile {}
@Entity()
class User {
  @Property()
  profile!: Profile;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Missing decorators for custom class types should add an empty @Property()
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/core";
class Profile {}
@Entity()
class User {
  profile!: Profile;
}`,
      output: /* typescript */ `import { Entity } from "@mikro-orm/core";
class Profile {}
@Entity()
class User {
  @Property()
  profile!: Profile;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // String arrays should use t.array
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  tags!: string[];
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.array })
  tags!: string[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Boolean arrays should use JSON storage
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.array })
  flags!: boolean[];
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.json })
  flags!: boolean[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Record arrays should use JSON storage
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.array })
  records!: Record<string, unknown>[];
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.json })
  records!: Record<string, unknown>[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Bare Array references should remove unnecessary type config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  values!: Array;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  values!: Array;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Nullable number arrays should keep valid vector config and add nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: VectorType })
  embedding?: number[];
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: VectorType, nullable: true })
  embedding?: number[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Enum types without decorators should add @Enum
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  role!: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role })
  role!: Role;
}`,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // Empty @Enum() should be rebuilt when nullable configuration is wrong
    {
      code: /* typescript */ `import { Entity, Enum } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum()
  role?: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role, nullable: true })
  role?: Role;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Non-object @Enum arguments should be rebuilt
    {
      code: /* typescript */ `import { Entity, Enum } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum(() => Role)
  role?: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/core";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role, nullable: true })
  role?: Role;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Non-object @Property arguments should be replaced with object config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property(() => String)
  name!: string;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Literal initializers without annotations should add Opt<T> and align @Property
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  enabled = true;
}`,
      output: [
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  enabled: Opt<boolean> = true;
}`,
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Number literal initializers without annotations should infer Opt<number>
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  score = 1;
}`,
      output: [
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  score: Opt<number> = 1;
}`,
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.float })
  score: Opt<number> = 1;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // String literal initializers without annotations should infer Opt<string>
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  title = "hello";
}`,
      output: [
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property()
  title: Opt<string> = "hello";
}`,
        /* typescript */ `import { Entity, Property, Opt } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  title: Opt<string> = "hello";
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Opt import should be inserted when there is no @mikro-orm/core import
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/postgresql";
@Entity()
class User {
  @Property()
  enabled: boolean = true;
}`,
      output: [
        /* typescript */ `import { Opt } from '@mikro-orm/core';
import { Entity, Property } from "@mikro-orm/postgresql";
@Entity()
class User {
  @Property()
  enabled: Opt<boolean> = true;
}`,
        /* typescript */ `import { Opt } from '@mikro-orm/core';
import { Entity, Property } from "@mikro-orm/postgresql";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Opt import should be inserted into multiline @mikro-orm/core imports
    {
      code: /* typescript */ `import {
  Entity,
  Property
} from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: boolean = true;
}`,
      output: /* typescript */ `import {
  Entity,
  Property,
  Opt
} from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      errors: [{ messageId: "useOptTypeForInitializedProperty" }],
    },
    // Invalid BigInt string storage for number should be replaced
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: new BigIntType('string') })
  score!: number;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.float })
  score!: number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Invalid BigInt number storage for string should be replaced
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: new BigIntType('number') })
  externalId!: string;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/core";
@Entity()
class User {
  @Property({ type: t.string })
  externalId!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
  ],
});
