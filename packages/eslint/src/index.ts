import { createRequire } from "node:module";

import type { ESLint, Linter } from "eslint";

import { rules } from "./rules/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/** Flat configuration presets exported by the `@nest-boot/eslint` plugin. */
export type NestBootConfigs = Readonly<Record<"recommended", Linter.Config[]>>;

/** Standard ESLint v9 plugin exported by `@nest-boot/eslint`. */
export interface NestBootPlugin extends Omit<
  ESLint.Plugin,
  "configs" | "meta" | "rules"
> {
  readonly meta: NonNullable<ESLint.Plugin["meta"]>;
  readonly rules: NonNullable<ESLint.Plugin["rules"]>;
  readonly configs: NestBootConfigs;
}

const configs = {} as NestBootConfigs;

const plugin: NestBootPlugin = {
  meta: {
    name: "eslint-plugin-nest-boot",
    namespace: "nest-boot",
    version,
  },
  rules: rules as unknown as NonNullable<ESLint.Plugin["rules"]>,
  configs,
} satisfies ESLint.Plugin;

const recommendedRules: Linter.RulesRecord = Object.fromEntries(
  Object.entries(rules)
    .filter(([, rule]) => rule.meta.docs?.recommended)
    .map(([name]) => [`nest-boot/${name}`, "error"]),
);

Object.assign(configs, {
  recommended: [
    {
      name: "@nest-boot/eslint/recommended",
      files: ["**/*.{ts,mts,cts,tsx}"],
      plugins: {
        "nest-boot": plugin,
      },
      rules: recommendedRules,
    },
  ],
} satisfies NestBootConfigs);

export default plugin;
