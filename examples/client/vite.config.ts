import { defineConfig, loadEnv } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // Local development and E2E servers run concurrently in this worktree.
    cacheDir: `node_modules/.vite/${mode}`,
    plugins: [
      mode === "development" && devtools(),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart({
        spa: {
          enabled: true,
        },
        router: {
          routesDirectory: "./app",
          indexToken: "page",
          routeToken: "layout",
          routeFileIgnorePattern:
            "^(?=.*\\.)((?!.*(?:^|\\/)(?:page|layout|__root)\\.(?:t|j)sx?$).)*$",
        },
      }),
      viteReact(),
    ],
    server: {
      proxy: {
        "/api": {
          target: env.API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});

export default config;
