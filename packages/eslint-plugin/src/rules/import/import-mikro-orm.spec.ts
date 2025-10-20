import { tester } from "../../utils/tester";
import rule from "./import-mikro-orm";

tester.run("import-mikro-orm", rule, {
  valid: [
    // 正确的导入来源
    /* typescript */ `
      import { MikroOrmModule } from "@nest-boot/mikro-orm";
    `,
    // 从其他包导入
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // 从 @mikro-orm/core 导入（不应该被替换）
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/core";
    `,
    // 命名导入
    /* typescript */ `
      import { InjectRepository } from "@nest-boot/mikro-orm";
    `,
  ],
  invalid: [
    // 从 @mikro-orm/nestjs 导入，应该替换为 @nest-boot/mikro-orm
    {
      code: /* typescript */ `
        import { MikroOrmModule } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { MikroOrmModule } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // InjectRepository 导入
    {
      code: /* typescript */ `
        import { InjectRepository } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import { InjectRepository } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // 类型导入
    {
      code: /* typescript */ `
        import type { MikroOrmModuleOptions } from "@mikro-orm/nestjs";
      `,
      output: /* typescript */ `
        import type { MikroOrmModuleOptions } from "@nest-boot/mikro-orm";
      `,
      errors: [{ messageId: "replaceMikroOrmImport" }],
    },
    // 混合导入
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
