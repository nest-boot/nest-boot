import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/components/thread-ui": fileURLToPath(new URL("..", import.meta.url)),
      "@/components": fileURLToPath(
        new URL("../../packages/shadcn-ui/components", import.meta.url),
      ),
      "@/hooks": fileURLToPath(
        new URL("../../packages/shadcn-ui/hooks", import.meta.url),
      ),
      "@/lib": fileURLToPath(
        new URL("../../packages/shadcn-ui/lib", import.meta.url),
      ),
      "@/utils": fileURLToPath(
        new URL("../../packages/shadcn-ui/utils", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["components/data-filter/__tests__/**/*.test.{ts,tsx}"],
    root,
  },
});
