import { ESLint } from "eslint";

import noDirectNestjsImport from "./rules/graphql/no-direct-nestjs-import.js";
import { rules } from "./rules/index.js";
import processorName from "./rules/queue/processor-name.js";

/** Rules registered under the @nest-boot/graphql namespace. */
export const graphqlPlugin = {
  rules: {
    "no-direct-nestjs-import": noDirectNestjsImport,
  },
} as unknown as ESLint.Plugin;

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
