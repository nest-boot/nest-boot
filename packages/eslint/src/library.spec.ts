import { app } from "./app.js";
import { base } from "./base.js";
import nestBoot from "./index.js";
import libraryDefault, { library } from "./library.js";

describe("@nest-boot/eslint/library", () => {
  it("combines base and plugin recommended presets in order and matches app", () => {
    expect(libraryDefault).toBe(library);
    expect(library).toEqual([...base, ...nestBoot.configs.recommended]);
    expect(library).toEqual(app);
  });
});
