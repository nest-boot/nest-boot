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

import { StagedUploadGraphQLModule } from "./staged-upload-graphql.module.js";

describe("StagedUploadGraphQLModule", () => {
  it("does not import the configurable core module", () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, StagedUploadGraphQLModule),
    ).toBeUndefined();
  });
});
