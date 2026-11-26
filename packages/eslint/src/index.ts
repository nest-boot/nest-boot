import { createRequire } from "node:module";

import type { ESLint } from "eslint";

import { createConfigs, type NestBootConfigs } from "./config.js";
import { rules } from "./rules/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/** Metadata identifying the Nest Boot ESLint plugin. */
export const meta: NonNullable<ESLint.Plugin["meta"]> = {
  name: "eslint-plugin-nest-boot",
  namespace: "nest-boot",
  version,
};

/** Flat configuration presets (`recommended`, `standard`, and `rules`). */
export const configs = {} as NestBootConfigs;

const plugin: ESLint.Plugin & {
  readonly meta: typeof meta;
  readonly rules: NonNullable<ESLint.Plugin["rules"]>;
  readonly configs: NestBootConfigs;
} = {
  meta,
  rules: rules as unknown as NonNullable<ESLint.Plugin["rules"]>,
  configs,
};

Object.assign(configs, createConfigs(plugin));

export { rules };
export default plugin;
