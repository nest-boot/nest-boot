import config from "@nest-boot/eslint-config";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...config,

  {
    rules: {
      "@nest-boot/import-graphql": "off",
    },
  },
];
