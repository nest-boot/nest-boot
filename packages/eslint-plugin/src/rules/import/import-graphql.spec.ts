import { tester } from "../../utils/tester";
import rule from "./import-graphql";

tester.run("import-graphql", rule, {
  valid: [
    // Correct import source
    /* typescript */ `
      import { Field, ObjectType } from "@nest-boot/graphql";
    `,
    // Importing from another package
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // Named import
    /* typescript */ `
      import { Resolver, Query } from "@nest-boot/graphql";
    `,
    // Default import
    /* typescript */ `
      import GraphQL from "@nest-boot/graphql";
    `,
  ],
  invalid: [
    // Importing from @nestjs/graphql, should be replaced with @nest-boot/graphql
    {
      code: /* typescript */ `
        import { Field, ObjectType } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import { Field, ObjectType } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // Resolver related imports
    {
      code: /* typescript */ `
        import { Resolver, Query, Mutation } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import { Resolver, Query, Mutation } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { GraphQLModule } from "@nestjs/graphql";
      `,
      output: /* typescript */ `
        import type { GraphQLModule } from "@nest-boot/graphql";
      `,
      errors: [{ messageId: "replaceGraphqlImport" }],
    },
    // Mixed imports
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
