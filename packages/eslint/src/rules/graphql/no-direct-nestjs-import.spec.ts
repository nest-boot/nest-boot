import { tester } from "../../../test/tester.js";
import rule from "./no-direct-nestjs-import.js";

tester.run("no-direct-nestjs-import", rule, {
  valid: [
    'import { Query, ResolveField } from "@nest-boot/graphql";',
    'import type { Complexity } from "@nest-boot/graphql";',
    'import { LazyMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage.js";',
    'const name = "@nestjs/graphql";',
    "declare namespace GraphQL { type Options = object; } import Options = GraphQL.Options;",
  ],
  invalid: [
    'import { ObjectType as Model } from "@nestjs/graphql";',
    'import * as graphql from "@nestjs/graphql";',
    'import type { Complexity } from "@nestjs/graphql";',
    'type Complexity = import("@nestjs/graphql").Complexity;',
    'import graphql = require("@nestjs/graphql");',
    'const graphql = import("@nestjs/graphql");',
    'export { Query } from "@nestjs/graphql";',
    'export * from "@nestjs/graphql";',
  ].map((code) => ({ code, errors: [{ messageId: "useNestBootGraphql" }] })),
});
