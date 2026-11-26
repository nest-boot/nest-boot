import { createRequire } from "node:module";

import type { ESLint, Linter } from "eslint";

import { rules } from "./rules/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/** Flat configuration presets exported by the `@nest-boot/eslint` plugin. */
export interface NestBootConfigs extends Record<string, Linter.Config[]> {
  readonly recommended: Linter.Config[];
}

/** Metadata identifying the Nest Boot ESLint plugin. */
export const meta: NonNullable<ESLint.Plugin["meta"]> = {
  name: "eslint-plugin-nest-boot",
  namespace: "nest-boot",
  version,
};

/** Flat configuration presets (`recommended`) for the Nest Boot ESLint plugin. */
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

Object.assign(configs, {
  recommended: [
    {
      name: "@nest-boot/eslint/recommended",
      files: ["**/*.{ts,mts,cts,tsx}"],
      plugins: {
        "nest-boot": plugin,
      },
      rules: {
        "nest-boot/database-entity-property-config-from-types": "error",
        "nest-boot/database-entity-property-definite-assignment": "error",
        "nest-boot/database-entity-property-no-spread": "error",
        "nest-boot/graphql-field-config-from-types": "error",
        "nest-boot/graphql-field-definite-assignment": "error",
        "nest-boot/graphql-no-direct-nestjs-import": "error",
        "nest-boot/queue-processor-name": "error",
      },
    },
  ],
} satisfies NestBootConfigs);

export { rules };
export default plugin;
