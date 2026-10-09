import { tester } from "../../utils/tester.js";
import rule from "./import-database.js";

tester.run("import-database", rule, {
  valid: [
    // Correct import source
    /* typescript */ `
      import { DatabaseModule } from "@nest-boot/database";
    `,
    // Importing from another package
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // Importing from @mikro-orm/core (should not be replaced)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";
    `,
    // Named import
    /* typescript */ `
      import { InjectRepository } from "@nest-boot/database";
    `,
  ],
  invalid: [
    {
      code: 'import { MikroOrmModule as MikroOrmModule } from "@mikro-orm/nestjs";',
      output:
        'import { DatabaseModule as MikroOrmModule } from "@nest-boot/database";',
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    {
      code: 'import Integration from "@mikro-orm/nestjs";',
      output: null,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    {
      code: 'import { "MikroOrmModule" as ORM } from "@mikro-orm/nestjs";',
      output: 'import { DatabaseModule as ORM } from "@nest-boot/database";',
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    {
      code: 'import { MikroOrmModule as ORM } from "@mikro-orm/nestjs"; ORM.forRoot({});',
      output:
        'import { DatabaseModule as ORM } from "@nest-boot/database"; ORM.forRoot({});',
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    {
      code: 'import { type MikroOrmModuleOptions, MikroOrmModule } from "@nest-boot/mikro-orm";',
      output:
        'import { type DatabaseModuleOptions as MikroOrmModuleOptions, DatabaseModule as MikroOrmModule } from "@nest-boot/database";',
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    {
      code: 'import * as ORM from "@mikro-orm/nestjs"; ORM.MikroOrmModule.forRoot({});',
      output: null,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    // Importing from @mikro-orm/nestjs, should be replaced with @nest-boot/database
    {
      code: /* typescript */ `
        import { MikroOrmModule } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { DatabaseModule as MikroOrmModule } from "@nest-boot/database";
      `,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    // InjectRepository import
    {
      code: /* typescript */ `
        import { InjectRepository } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { InjectRepository } from "@nest-boot/database";
      `,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { MikroOrmModuleOptions } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import type { DatabaseModuleOptions as MikroOrmModuleOptions } from "@nest-boot/database";
      `,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
    // Mixed imports
    {
      code: /* typescript */ `
        import { MikroOrmModule, InjectRepository } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { DatabaseModule as MikroOrmModule, InjectRepository } from "@nest-boot/database";
      `,
      errors: [{ messageId: "replaceDatabaseImport" }],
    },
  ],
});
