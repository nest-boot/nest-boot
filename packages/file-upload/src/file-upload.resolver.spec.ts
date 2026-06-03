import { FileUploadResolver } from "./file-upload.resolver";
import { FileUploadService } from "./file-upload.service";

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
    const create = jest.fn().mockResolvedValue(result);
    const service = {
      create,
    } as unknown as FileUploadService;
    const resolver = new FileUploadResolver(service);
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
