import app from "./app.js";
import base from "./base.js";
import nestBoot from "./index.js";
import library from "./library.js";

describe("@nest-boot/eslint/library", () => {
  it("combines base and plugin recommended presets in order and matches app", () => {
    expect(library).toEqual([...base, ...nestBoot.configs.recommended]);
    expect(library).toEqual(app);
  });
});
