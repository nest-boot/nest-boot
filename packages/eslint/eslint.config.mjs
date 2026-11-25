import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([...nestBoot.configs.standard]);
