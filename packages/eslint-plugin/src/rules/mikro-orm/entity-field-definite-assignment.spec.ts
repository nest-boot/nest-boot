import { tester } from "../../utils/tester.js";
import rule from "./entity-field-definite-assignment.js";

tester.run("entity-field-definite-assignment", rule, {
  valid: [
    // Property with initializer, no ! needed
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        createdAt: Date = new Date();
      }
    `,
    // Property with !, no initializer
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        name!: string;
      }
    `,
    // Optional property, no ! needed
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        age?: number;
      }
    `,
    // Declare properties cannot use definite assignment assertions
    /* typescript */ `
      @Entity()
      class User extends BaseUser {
        @Property()
        declare name: string;
      }
    `,
    // Nullable property with initializer
    /* typescript */ `
      @Entity()
      class User {
        @Property({ nullable: true })
        name: string | null = null;
      }
    `,
    // Non-Entity class is not checked
    /* typescript */ `
      class NotAnEntity {
        @Property()
        field: string;
      }
    `,
    // Property without @Property decorator is not checked
    /* typescript */ `
      @Entity()
      class User {
        field: string;
      }
    `,
    // Methods are ignored
    /* typescript */ `
      @Entity()
      class User {
        method() {
          return "value";
        }
      }
    `,
    // Computed property names are skipped
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        ["name"]: string;
      }
    `,
    // @Enum decorator - with !
    /* typescript */ `
      @Entity()
      class User {
        @Enum()
        role!: UserRole;
      }
    `,
    // @OneToOne decorator - using Ref
    /* typescript */ `
      @Entity()
      class User {
        @OneToOne()
        profile!: Ref<Profile>;
      }
    `,
    // @OneToMany decorator - initialized with Collection
    /* typescript */ `
      @Entity()
      class User {
        @OneToMany()
        posts = new Collection<Post>(this);
      }
    `,
    // @ManyToOne decorator - using Ref
    /* typescript */ `
      @Entity()
      class Post {
        @ManyToOne()
        author!: Ref<User>;
      }
    `,
    // @ManyToMany decorator - initialized with Collection
    /* typescript */ `
      @Entity()
      class User {
        @ManyToMany()
        tags = new Collection<Tag>(this);
      }
    `,
  ],
  invalid: [
    // No initializer and no !
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @Property()
          name: string;
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @Property()
          name!: string;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    // @Enum decorator - no initializer and no !
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @Enum()
          role: UserRole;
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @Enum()
          role!: UserRole;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    // @OneToOne decorator - no initializer and no ! (using Ref)
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @OneToOne()
          profile: Ref<Profile>;
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @OneToOne()
          profile!: Ref<Profile>;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    // @ManyToOne decorator - no initializer and no ! (using Ref)
    {
      code: /* typescript */ `
        @Entity()
        class Post {
          @ManyToOne()
          author: Ref<User>;
        }
      `,
      output: /* typescript */ `
        @Entity()
        class Post {
          @ManyToOne()
          author!: Ref<User>;
        }
      `,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
  ],
});
