import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  ...tanstackConfig,
  {
    ignores: [
      "src/gql/**",
      "node_modules/**",
      "dist/**",
      ".tanstack/**",
      "eslint.config.js",
      "prettier.config.js",
      "src/components/ui/**",
      "src/components/fabric-ui/**",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/naming-convention": "off",
      "no-shadow": "off",
    },
  },
];
