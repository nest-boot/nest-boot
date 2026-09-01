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

import { StagedUploadModule } from "./staged-upload.module.js";
import { MODULE_OPTIONS_TOKEN } from "./staged-upload.module-definition.js";

describe("StagedUploadModule", () => {
  const options = {};

  it("should register synchronous options", () => {
    const dynamicModule = StagedUploadModule.register(options);

    expect(dynamicModule.module).toBe(StagedUploadModule);
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
    const dynamicModule = StagedUploadModule.registerAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(StagedUploadModule);
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
