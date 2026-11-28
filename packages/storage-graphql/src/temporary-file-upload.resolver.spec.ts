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
  MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE,
  StorageService,
} from "@nest-boot/storage";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Mock } from "vitest";

import { TemporaryFileUploadResolver } from "./temporary-file-upload.resolver.js";

describe("TemporaryFileUploadResolver", () => {
  it("delegates temporary file upload URL creation to StorageService and enforces batch limit", async () => {
    const itemResult = {
      url: "https://s3.local/uploads",
      resourceUrl: "https://s3.local/uploads/tmp/file.png?X-Amz-Signature=1",
      fields: [{ name: "key", value: "tmp/file.png" }],
    };
    const createTemporaryFileUploadUrl = vi.fn().mockResolvedValue(itemResult);
    const resolver = await createResolver(createTemporaryFileUploadUrl);
    const input = [
      {
        fileSize: 123,
        mimeType: "image/png",
        name: "file.png",
      },
    ];

    await expect(
      resolver.createTemporaryFileUploadUrls(input),
    ).resolves.toEqual([itemResult]);
    expect(createTemporaryFileUploadUrl).toHaveBeenCalledWith(input[0]);

    const tooMany = Array.from(
      { length: MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE + 1 },
      () => input[0],
    );
    await expect(
      resolver.createTemporaryFileUploadUrls(tooMany),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createTemporaryFileUploadUrl).toHaveBeenCalledTimes(1);
  });
});

/**
 * Returns test resolver and its mocked dependencies.
 * @param createTemporaryFileUploadUrl - Mock implementation of StorageService.createTemporaryFileUploadUrl.
 * @returns Test resolver instance.
 */
async function createResolver(createTemporaryFileUploadUrl: Mock) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TemporaryFileUploadResolver,
      {
        provide: StorageService,
        useValue: { createTemporaryFileUploadUrl },
      },
    ],
  }).compile();

  return moduleRef.get(TemporaryFileUploadResolver);
}
