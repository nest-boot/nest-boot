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

import { StagedUploadResolver } from "./staged-upload.resolver.js";
import { StagedUploadGraphQLModule } from "./staged-upload-graphql.module.js";

describe("StagedUploadGraphQLModule", () => {
  it("uses the globally registered staged upload service", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        StorageModule.register({ bucket: "test-bucket" }),
        StagedUploadModule.register({}),
        StagedUploadGraphQLModule,
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
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, StagedUploadGraphQLModule),
    ).toBeUndefined();
  });
});
