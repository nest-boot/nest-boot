import { tester } from "../../utils/tester";
import rule from "./entity-property-config-from-types";

tester.run("entity-property-config-from-types", rule, {
  valid: [
    // 正确的 string 类型
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.string })
        name!: string;
      }
    `,
    // 正确的 nullable 配置
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.string, nullable: true })
        name?: string;
      }
    `,
    // 使用 Opt<T> 类型且有初始化值
    /* typescript */ `
      import { Entity, Property, Opt } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive: Opt<boolean> = false;
      }
    `,
    // 关系装饰器不需要 @Property
    /* typescript */ `
      import { Entity, ManyToOne } from "@mikro-orm/core";

      @Entity()
      class Post {
        @ManyToOne()
        author!: User;
      }
    `,
    // PrimaryKey 需要 type 配置
    /* typescript */ `
      import { Entity, PrimaryKey, t } from "@mikro-orm/core";

      @Entity()
      class User {
        @PrimaryKey({ type: t.integer })
        id!: number;
      }
    `,
    // 枚举类型使用 @Enum
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
    // 数组类型
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.array })
        tags!: number[];
      }
    `,
    // boolean 类型
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive!: boolean;
      }
    `,
    // Date 类型使用 t.datetime
    /* typescript */ `
      import { Entity, Property, Opt } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.datetime, defaultRaw: 'now()' })
        createdAt: Opt<Date> = new Date();
      }
    `,
    // Date 类型使用 t.date（有效的 Date 类型配置）
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.date })
        birthDate!: Date;
      }
    `,
    // Date 类型使用 t.time（有效的 Date 类型配置）
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.time })
        workTime!: Date;
      }
    `,
    // 使用 t.text 代替 t.string（有效的 string 类型配置）
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";

      @Entity()
      class User {
        @Property({ type: t.text })
        description!: string;
      }
    `,
    // 非 Entity 类不检查
    /* typescript */ `
      class NotAnEntity {
        field: string;
      }
    `,
  ],
  invalid: [
    // type 配置不匹配
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
    // nullable 配置不匹配
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
    // 有初始化值但没有使用 Opt<T>
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
    // 枚举类型应该使用 @Enum 装饰器
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
    // @Enum 的 nullable 配置不匹配
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
    // 数组类型配置不匹配
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
    // 空的 @Property() 应该添加 type: t.boolean
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
    // 空的 @Property() 应该添加 type: t.datetime（Date 类型）
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
    // Date 类型配置错误应该修正为 t.datetime
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
