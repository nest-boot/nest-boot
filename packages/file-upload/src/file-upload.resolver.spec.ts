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

import { FileUploadResolver } from "./file-upload.resolver.js";
import { FileUploadService } from "./file-upload.service.js";

describe("FileUploadResolver", () => {
  it("should delegate file upload creation to the service", async () => {
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

    await expect(resolver.createFileUploads(input)).resolves.toBe(result);
    expect(create).toHaveBeenCalledWith(input);
  });
});

async function createResolver(create: Mock) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      FileUploadResolver,
      {
        provide: FileUploadService,
        useValue: {
          create,
        },
      },
    ],
  }).compile();

  return moduleRef.get(FileUploadResolver);
}
