vi.mock("@nest-boot/graphql", () => {
  const decorator = () => () => undefined;

  return {
    Field: decorator,
    InputType: decorator,
    Int: Number,
    ObjectType: decorator,
  };
});

import { FileUpload } from "./file-upload.object.js";
import { FileUploadField } from "./file-upload-field.object.js";
import { FileUploadInput } from "./inputs/file-upload.input.js";

describe("file upload GraphQL models", () => {
  it("should store file upload response fields", () => {
    const field = new FileUploadField();
    field.name = "key";
    field.value = "tmp/file.png";

    const upload = new FileUpload();
    upload.fields = [field];
    upload.url = "https://s3.local/tmp/file.png";

    expect(upload).toEqual({
      fields: [
        {
          name: "key",
          value: "tmp/file.png",
        },
      ],
      url: "https://s3.local/tmp/file.png",
    });
  });

  it("should store upload input values", () => {
    const input = new FileUploadInput();
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
