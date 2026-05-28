import { PermissionModule } from "./permission.module";

describe("PermissionModule", () => {
  it("creates the configurable permission module", () => {
    const dynamicModule = PermissionModule.forRoot({
      buildAbility: jest.fn(() => null),
    });

    expect(dynamicModule.module).toBe(PermissionModule);
  });
});
