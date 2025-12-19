import config from "@nest-boot/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...config,

  {
    rules: {
      "@nest-boot/import-graphql": "off",
    },
  },
]);
