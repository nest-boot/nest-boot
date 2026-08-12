import { TemporaryDirectoryModule, TemporaryDirectoryService } from ".";
import { MODULE_OPTIONS_TOKEN } from "./temporary-directory.module-definition";

describe("temporary-directory public API", () => {
  it("exports the module and service", () => {
    expect(TemporaryDirectoryModule).toBeDefined();
    expect(TemporaryDirectoryService).toBeDefined();
  });

  it("registers synchronous and asynchronous options", () => {
    const options = { basePath: "temp" };
    const useFactory = () => options;

    expect(TemporaryDirectoryModule.register(options).providers).toEqual(
      expect.arrayContaining([
        { provide: MODULE_OPTIONS_TOKEN, useValue: options },
      ]),
    );
    expect(
      TemporaryDirectoryModule.registerAsync({ useFactory }).providers,
    ).toEqual(
      expect.arrayContaining([
        { inject: [], provide: MODULE_OPTIONS_TOKEN, useFactory },
      ]),
    );
  });
});
