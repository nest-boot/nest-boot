vi.mock("@nest-boot/graphql", () => {
  const decorator = () => () => undefined;

  return {
    Field: decorator,
    InputType: decorator,
    Int: Number,
    ObjectType: decorator,
  };
});

import { StagedUploadInput } from "./inputs/staged-upload.input.js";
import { StagedUpload } from "./staged-upload.object.js";
import { StagedUploadField } from "./staged-upload-field.object.js";

describe("staged upload GraphQL models", () => {
  it("stores staged upload response fields", () => {
    const field = new StagedUploadField();
    field.name = "key";
    field.value = "tmp/file.png";

    const upload = new StagedUpload();
    upload.fields = [field];
    upload.url = "https://s3.local/tmp/file.png";

    expect(upload).toEqual({
      fields: [{ name: "key", value: "tmp/file.png" }],
      url: "https://s3.local/tmp/file.png",
    });
  });

  it("stores upload input values", () => {
    const input = new StagedUploadInput();
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
