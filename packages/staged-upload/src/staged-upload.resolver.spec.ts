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

import { Test } from "@nestjs/testing";
import type { Mock } from "vitest";

import { StagedUploadResolver } from "./staged-upload.resolver.js";
import { StagedUploadService } from "./staged-upload.service.js";

describe("StagedUploadResolver", () => {
  it("should delegate staged upload creation to the service", async () => {
    const result = [
      {
        fields: [
          {
            name: "key",
            value: "tmp/file.png",
          },
        ],
        url: "https://s3.local/tmp/file.png",
      },
    ];
    const create = vi.fn().mockResolvedValue(result);
    const resolver = await createResolver(create);
    const input = [
      {
        fileSize: 123,
        mimeType: "image/png",
        name: "file.png",
      },
    ];

    await expect(resolver.createStagedUploads(input)).resolves.toBe(result);
    expect(create).toHaveBeenCalledWith(input);
  });
});

async function createResolver(create: Mock) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StagedUploadResolver,
      {
        provide: StagedUploadService,
        useValue: {
          create,
        },
      },
    ],
  }).compile();

  return moduleRef.get(StagedUploadResolver);
}
