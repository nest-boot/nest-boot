import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./database-entity-property-definite-assignment.js";

const ruleTester = new RuleTester();

ruleTester.run("database-entity-property-definite-assignment", rule, {
  valid: [
    `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Audit
@Entity()
class Book {
  @Validate
  @Property()
  title!: string;
}`,
    `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "other-decorators";
@Entity() class Book { @SearchableProperty() search: string; }`,
    `import { Entity as Model } from "other-decorators";
import { SearchableProperty } from "@nest-boot/database";
@Model() class Book { @SearchableProperty({ properties: "search" }) search: string; }`,
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        createdAt: Date = new Date();
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        name!: string;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        age?: number;
      }
    `,
    /* typescript */ `
      @Entity()
      class User extends BaseUser {
        @Property()
        declare name: string;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @Property({ nullable: true })
        name: string | null = null;
      }
    `,
    /* typescript */ `
      class NotAnEntity {
        @Property()
        field: string;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        field: string;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        method() {
          return "value";
        }
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @Property()
        ["name"]: string;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @Enum()
        role!: UserRole;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @OneToOne()
        profile!: Ref<Profile>;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @OneToMany()
        posts = new Collection<Post>(this);
      }
    `,
    /* typescript */ `
      @Entity()
      class Post {
        @ManyToOne()
        author!: Ref<User>;
      }
    `,
    /* typescript */ `
      @Entity()
      class User {
        @ManyToMany()
        tags = new Collection<Tag>(this);
      }
    `,
  ],
  invalid: [
    {
      code: `import { Entity as Model } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Model() class Book { @Search({ properties: "search" }) search: string; }`,
      output: `import { Entity as Model } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Model() class Book { @Search({ properties: "search" }) search!: string; }`,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    {
      code: `import * as entities from "@mikro-orm/decorators/legacy";
import * as database from "@nest-boot/database";
@entities.Entity() class Book { @database.SearchableProperty({ properties: "search" }) search: string | null; }`,
      output: `import * as entities from "@mikro-orm/decorators/legacy";
import * as database from "@nest-boot/database";
@entities.Entity() class Book { @database.SearchableProperty({ properties: "search" }) search!: string | null; }`,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
    {
      code: `@Entity()
class Book {
  @SearchableProperty({ properties: ["title"] })
  search: string;
}`,
      output: `@Entity()
class Book {
  @SearchableProperty({ properties: ["title"] })
  search!: string;
}`,
      errors: [{ messageId: "addDefiniteAssignment" }],
    },
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
