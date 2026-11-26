import appDefault, { app } from "./app.js";
import { base } from "./base.js";
import nestBoot from "./index.js";

describe("@nest-boot/eslint/app", () => {
  it("combines base and plugin recommended presets in order", () => {
    expect(appDefault).toBe(app);
    expect(app).toEqual([...base, ...nestBoot.configs.recommended]);
  });
});
