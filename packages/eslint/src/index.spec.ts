import nestBoot, { configs, plugin } from "./index.js";

describe("@nest-boot/eslint public API", () => {
  it("exports configs and plugin on both default and named exports", () => {
    expect(nestBoot).toEqual({ configs, plugin });
    expect(Array.isArray(nestBoot.configs.standard)).toBe(true);
    expect(Array.isArray(nestBoot.configs.rules)).toBe(true);
    expect(Array.isArray(nestBoot.configs.recommended)).toBe(true);
    expect(nestBoot.plugin).toBe(plugin);
  });
});
