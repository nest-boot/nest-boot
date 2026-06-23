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

import { FileUploadModule } from "./file-upload.module.js";
import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition.js";

describe("FileUploadModule", () => {
  const options = {
    bucket: "uploads",
    client: {
      endpoint: "http://s3.local",
      region: "us-east-1",
    },
  };

  it("should register synchronous options", () => {
    const dynamicModule = FileUploadModule.register(options);

    expect(dynamicModule.module).toBe(FileUploadModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
  });

  it("should register asynchronous options", () => {
    const useFactory = () => options;
    const dynamicModule = FileUploadModule.registerAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(FileUploadModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });
});
