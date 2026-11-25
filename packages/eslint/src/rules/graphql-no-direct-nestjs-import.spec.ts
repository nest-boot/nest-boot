import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./graphql-no-direct-nestjs-import.js";

const ruleTester = new RuleTester();

ruleTester.run("graphql-no-direct-nestjs-import", rule, {
  valid: [
    'import { Query, ResolveField } from "@nest-boot/graphql";',
    'import type { Complexity } from "@nest-boot/graphql";',
    'import { LazyMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage.js";',
    'const name = "@nestjs/graphql";',
    "declare namespace GraphQL { type Options = object; } import Options = GraphQL.Options;",
  ],
  invalid: [
    {
      code: 'import { ObjectType as Model } from "@nestjs/graphql";',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'import * as graphql from "@nestjs/graphql";',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'import type { Complexity } from "@nestjs/graphql";',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'type Complexity = import("@nestjs/graphql").Complexity;',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'import graphql = require("@nestjs/graphql");',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'const graphql = import("@nestjs/graphql");',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'export { Query } from "@nestjs/graphql";',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
    {
      code: 'export * from "@nestjs/graphql";',
      errors: [{ messageId: "useNestBootGraphql" }],
    },
  ],
});
