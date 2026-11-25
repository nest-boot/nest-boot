import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...nestBoot.configs.recommended,
  { rules: { "nest-boot/graphql/no-direct-nestjs-import": "off" } },
]);
