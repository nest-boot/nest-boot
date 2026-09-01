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

import {
  StagedUploadModule,
  StagedUploadService,
} from "@nest-boot/staged-upload";
import { StorageModule } from "@nest-boot/storage";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { Test } from "@nestjs/testing";

import { GraphQLStagedUploadModule } from "./graphql-staged-upload.module.js";
import { StagedUploadResolver } from "./staged-upload.resolver.js";

describe("GraphQLStagedUploadModule", () => {
  it("uses the globally registered staged upload service", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        StorageModule.register({ bucket: "test-bucket" }),
        StagedUploadModule.register({}),
        GraphQLStagedUploadModule,
      ],
    }).compile();

    expect(moduleRef.get(StagedUploadResolver)).toBeInstanceOf(
      StagedUploadResolver,
    );
    expect(moduleRef.get(StagedUploadService)).toBeInstanceOf(
      StagedUploadService,
    );

    await moduleRef.close();
  });

  it("does not import the configurable core module", () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, GraphQLStagedUploadModule),
    ).toBeUndefined();
  });
});
