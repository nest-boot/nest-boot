import { tester } from "../../utils/tester";
import rule from "./import-graphql";

tester.run("import-graphql", rule, {
  valid: [
    // 正确的导入来源
    /* typescript */ `
      import { Field, ObjectType } from "@nest-boot/graphql";
    `,
    // 从其他包导入
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // 命名导入
    /* typescript */ `
      import { Resolver, Query } from "@nest-boot/graphql";
    `,
    // 默认导入
    /* typescript */ `
      import GraphQL from "@nest-boot/graphql";
    `,
  ],
  invalid: [
    // 从 @nestjs/graphql 导入，应该替换为 @nest-boot/graphql
    {
      code: /* typescript */ `
        import { Field, ObjectType } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import { Field, ObjectType } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // Resolver 相关导入
    {
      code: /* typescript */ `
        import { Resolver, Query, Mutation } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import { Resolver, Query, Mutation } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // 类型导入
    {
      code: /* typescript */ `
        import type { GraphQLModule } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import type { GraphQLModule } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // 混合导入
    {
      code: /* typescript */ `
        import { Args, Int } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import { Args, Int } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
  ],
});
