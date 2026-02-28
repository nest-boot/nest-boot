import { tester } from "../../utils/tester";
import rule from "./import-mikro-orm";

tester.run("import-mikro-orm", rule, {
  valid: [
    // Correct import source
    /* typescript */ `
      import { MikroOrmModule } from "@nest-boot/mikro-orm";
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
      import { InjectRepository } from "@nest-boot/mikro-orm";
    `,
  ],
  invalid: [
    // Importing from @mikro-orm/nestjs, should be replaced with @nest-boot/mikro-orm
    {
      code: /* typescript */ `
        import { MikroOrmModule } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { MikroOrmModule } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // InjectRepository import
    {
      code: /* typescript */ `
        import { InjectRepository } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { InjectRepository } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { MikroOrmModuleOptions } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import type { MikroOrmModuleOptions } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // Mixed imports
    {
      code: /* typescript */ `
        import { MikroOrmModule, InjectRepository } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { MikroOrmModule, InjectRepository } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
  ],
});
