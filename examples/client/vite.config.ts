import { defineConfig, loadEnv } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.API_URL,
      changeOrigin: true,
    },
  };

  return {
    // Local development and E2E servers run concurrently in this worktree.
    cacheDir: `node_modules/.vite/${mode}`,
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      mode === "development" && devtools(),
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
      proxy,
    },
    preview: {
      proxy,
    },
  };
});

export default config;
