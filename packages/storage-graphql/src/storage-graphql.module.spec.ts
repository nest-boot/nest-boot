vi.mock("@nest-boot/graphql", () => {
  const decorator = () => () => undefined;
  return {
    Args: decorator,
    Field: decorator,
    InputType: decorator,
    Int: Number,
    Mutation: decorator,
    ObjectType: decorator,
    Resolver: decorator,
  };
});

import { MODULE_METADATA } from "@nestjs/common/constants.js";

import { StorageGraphQLModule } from "./storage-graphql.module.js";

describe("StorageGraphQLModule", () => {
  it("does not import the configurable core StorageModule", () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, StorageGraphQLModule),
    ).toBeUndefined();
  });
});
