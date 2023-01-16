import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      path: "path-browserify",
    },
  },
  server: {
    proxy: {
      "/queue-dashboard/api": "http://localhost:3000",
    },
  },
});
