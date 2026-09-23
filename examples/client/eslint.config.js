import { tanstackConfig } from "@tanstack/eslint-config";
import { plugin as shadcn } from "@shadcn/lint";

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
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { shadcn },
    settings: {
      shadcn: {
        // components.json discovers shadcn/ui and the theme; include Thread UI too.
        componentImports: ["^@/components/thread-ui(/|$)"],
      },
    },
    rules: {
      "shadcn/no-unknown-classes": "error",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
      "shadcn/no-inline-styles": "error",
      "shadcn/require-static-classes": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
    },
  },
  {
    files: ["src/components/thread-ui/**"],
    rules: {
      // Component implementations define their own appearance and variants.
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
  {
    files: ["src/components/thread-ui/badge/index.tsx"],
    rules: {
      // Badge's color variants intentionally use these light/dark palette shades.
      "shadcn/no-raw-colors": [
        "error",
        {
          allow: [
            "border-*-200",
            "border-*-800",
            "bg-*-100",
            "bg-*-950",
            "text-*-800",
            "text-*-200",
          ],
        },
      ],
    },
  },
];
