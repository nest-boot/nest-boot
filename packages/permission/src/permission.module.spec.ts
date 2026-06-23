import { PermissionModule } from "./permission.module.js";

describe("PermissionModule", () => {
  it("creates the configurable permission module", () => {
    const dynamicModule = PermissionModule.forRoot({
      buildAbility: vi.fn(() => null),
    });

    expect(dynamicModule.module).toBe(PermissionModule);
  });
});
