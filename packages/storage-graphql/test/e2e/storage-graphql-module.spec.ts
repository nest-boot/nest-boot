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

import { StorageModule, StorageService } from "@nest-boot/storage";
import { Test } from "@nestjs/testing";

import { StorageGraphQLModule } from "../../src/storage-graphql.module.js";
import { TemporaryFileUploadResolver } from "../../src/temporary-file-upload.resolver.js";

describe("StorageGraphQLModule", () => {
  it("uses the globally registered StorageService", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        StorageModule.forRoot({ bucket: "test-bucket" }),
        StorageGraphQLModule,
      ],
    }).compile();
    expect(moduleRef.get(TemporaryFileUploadResolver)).toBeInstanceOf(
      TemporaryFileUploadResolver,
    );
    expect(moduleRef.get(StorageService)).toBeInstanceOf(StorageService);
    await moduleRef.close();
  });
});
