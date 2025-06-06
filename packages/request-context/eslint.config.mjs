import config from "@nest-boot/eslint-config";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...config,
  {
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
  },
];
