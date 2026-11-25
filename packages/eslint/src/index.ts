import type { ESLint, Linter } from "eslint";

import { configs } from "./config.js";
import { plugin } from "./plugin.js";

export { configs } from "./config.js";
export { plugin } from "./plugin.js";

const nestBoot: {
  readonly configs: {
    readonly standard: Linter.Config[];
    readonly rules: Linter.Config[];
    readonly recommended: Linter.Config[];
  };
  readonly plugin: ESLint.Plugin;
} = {
  configs,
  plugin,
};

export default nestBoot;
