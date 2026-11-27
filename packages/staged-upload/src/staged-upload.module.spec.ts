import { StagedUploadModule } from "./staged-upload.module.js";
import { MODULE_OPTIONS_TOKEN } from "./staged-upload.module-definition.js";

describe("StagedUploadModule", () => {
  const options = {};
  it("should register synchronous options", () => {
    expect(StagedUploadModule.forRoot().module).toBe(StagedUploadModule);
    const dynamicModule = StagedUploadModule.forRoot(options);
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
    const dynamicModule = StagedUploadModule.forRootAsync({
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
