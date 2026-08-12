import { TemporaryDirectoryModule, TemporaryDirectoryService } from ".";

describe("temporary-directory public API", () => {
  it("exports the static module and service", () => {
    expect(TemporaryDirectoryModule).toBeDefined();
    expect(TemporaryDirectoryService).toBeDefined();
  });
});
