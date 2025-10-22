import { tester } from "../../utils/tester";
import rule from "./entity-field-definite-assignment";

tester.run("entity-field-definite-assignment", rule, {
  valid: [
    // 有初始化值的属性，不需要 !
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        createdAt: Date = new Date();
      }
    `,
    // 有 ! 的属性，没有初始化值
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        name!: string;
      }
    `,
    // 可选属性，不需要 !
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        age?: number;
      }
    `,
    // 可空属性且有初始化值
    /* typescript */ `
      @Entity()
      class User {
        @Property({ nullable: true })
        name: string | null = null;
      }
    `,
    // 非 Entity 类不检查
    /* typescript */ `
      class NotAnEntity {
        @Property()
        field: string;
      }
    `,
    // 没有 @Property 装饰器不检查
    /* typescript */ `
      @Entity()
      class User {
        field: string;
      }
    `,
    // @Enum 装饰器 - 有 !
    /* typescript */ `
      @Entity()
      class User {
        @Enum()
        role!: UserRole;
      }
    `,
    // @OneToOne 装饰器 - 使用 Ref
    /* typescript */ `
      @Entity()
      class User {
        @OneToOne()
        profile!: Ref<Profile>;
      }
    `,
    // @OneToMany 装饰器 - 使用 Collection 初始化
    /* typescript */ `
      @Entity()
      class User {
        @OneToMany()
        posts = new Collection<Post>(this);
      }
    `,
    // @ManyToOne 装饰器 - 使用 Ref
    /* typescript */ `
      @Entity()
      class Post {
        @ManyToOne()
        author!: Ref<User>;
      }
    `,
    // @ManyToMany 装饰器 - 使用 Collection 初始化
    /* typescript */ `
      @Entity()
      class User {
        @ManyToMany()
        tags = new Collection<Tag>(this);
      }
    `,
  ],
  invalid: [
    // 没有初始化值，也没有 !
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
    // 有初始化值，但也有 !
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @Property()
          createdAt!: Date = new Date();
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @Property()
          createdAt: Date = new Date();
        }
      `,
      errors: [{ messageId: "removeDefiniteAssignment" }],
    },
    // @Enum 装饰器 - 没有初始化值,也没有 !
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
    // @OneToOne 装饰器 - 没有初始化值,也没有 ! (使用 Ref)
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
    // @OneToMany 装饰器 - 有初始化值,但也有 ! (使用 Collection)
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @OneToMany()
          posts!: Collection<Post> = new Collection<Post>(this);
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @OneToMany()
          posts: Collection<Post> = new Collection<Post>(this);
        }
      `,
      errors: [{ messageId: "removeDefiniteAssignment" }],
    },
    // @ManyToOne 装饰器 - 没有初始化值,也没有 ! (使用 Ref)
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
    // @ManyToMany 装饰器 - 有初始化值,但也有 ! (使用 Collection)
    {
      code: /* typescript */ `
        @Entity()
        class User {
          @ManyToMany()
          tags!: Collection<Tag> = new Collection<Tag>(this);
        }
      `,
      output: /* typescript */ `
        @Entity()
        class User {
          @ManyToMany()
          tags: Collection<Tag> = new Collection<Tag>(this);
        }
      `,
      errors: [{ messageId: "removeDefiniteAssignment" }],
    },
  ],
});
