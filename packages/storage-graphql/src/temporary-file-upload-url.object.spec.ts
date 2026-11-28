vi.mock("@nest-boot/graphql", () => {
  const decorator = () => () => undefined;

  return {
    Field: decorator,
    InputType: decorator,
    Int: Number,
    ObjectType: decorator,
  };
});

import { TemporaryFileUploadInput } from "./inputs/temporary-file-upload.input.js";
import { TemporaryFileUploadField } from "./temporary-file-upload-field.object.js";
import { TemporaryFileUploadUrl } from "./temporary-file-upload-url.object.js";

describe("storage GraphQL models", () => {
  it("stores temporary file upload response fields", () => {
    const field = new TemporaryFileUploadField();
    field.name = "key";
    field.value = "tmp/file.png";

    const upload = new TemporaryFileUploadUrl();
    upload.url = "https://s3.local/uploads";
    upload.resourceUrl =
      "https://s3.local/uploads/tmp/file.png?X-Amz-Signature=1";
    upload.fields = [field];

    expect(upload).toEqual({
      url: "https://s3.local/uploads",
      resourceUrl: "https://s3.local/uploads/tmp/file.png?X-Amz-Signature=1",
      fields: [{ name: "key", value: "tmp/file.png" }],
    });
  });

  it("stores temporary file upload input values", () => {
    const input = new TemporaryFileUploadInput();
    input.fileSize = 123;
    input.mimeType = "image/png";
    input.name = "file.png";

    expect(input).toEqual({
      fileSize: 123,
      mimeType: "image/png",
      name: "file.png",
    });
  });
});
