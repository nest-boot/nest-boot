import { ESLint } from "eslint";

import { rules } from "./rules";

const plugin = {
  rules,
} as unknown as ESLint.Plugin;

export = plugin;
