import { ESLint } from "eslint";

import { rules } from "./rules/index.js";

const plugin = {
  rules,
} as unknown as ESLint.Plugin;

export default plugin;
