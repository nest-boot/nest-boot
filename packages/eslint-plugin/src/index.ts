import { ESLint } from "eslint";

import { rules } from "./rules/index.js";
import processorName from "./rules/queue/processor-name.js";

/** Queue rules registered under the @nest-boot/queue namespace. */
export const queuePlugin = {
  rules: {
    "processor-name": processorName,
  },
} as unknown as ESLint.Plugin;

const plugin = {
  rules,
} as unknown as ESLint.Plugin;

export default plugin;
