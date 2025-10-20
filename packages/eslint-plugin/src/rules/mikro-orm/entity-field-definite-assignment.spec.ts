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
  ],
});
