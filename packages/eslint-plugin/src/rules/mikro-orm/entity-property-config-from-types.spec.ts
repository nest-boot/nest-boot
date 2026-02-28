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
        import { Entity, Property } from "@mikro-orm/core";

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
  ],
});
