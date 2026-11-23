import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import express from "express";

import { MastraStudioMiddleware } from "./mastra-studio.middleware.js";

const requireFromHere = createRequire(import.meta.url);

/**
 * Finds the first bundled asset file in Mastra Studio's `assets/` directory.
 * @returns Relative asset path under Studio root, or `undefined` if none exist
 */
function findFirstStudioAssetPath(): string | undefined {
  const mastraPkgPath = requireFromHere.resolve("mastra/package.json");
  const assetsDir = path.join(
    path.dirname(mastraPkgPath),
    "dist",
    "studio",
    "assets",
  );
  const files = readdirSync(assetsDir);
  return files[0] ? `/assets/${files[0]}` : undefined;
}

/**
 * Starts an ephemeral Express HTTP server mounting the given Studio middleware.
 * @param middleware - Studio middleware instance under test
 * @returns Server base URL and async shutdown helper
 */
async function startMiddlewareServer(middleware: MastraStudioMiddleware) {
  const app = express();
  app.use((req, res, next) => {
    middleware.use(req, res, next);
  });
  app.use((_req, res) => {
    res.status(404).send("fallthrough");
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => {
      resolve(started);
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected numeric server port");
  }

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

describe("MastraStudioMiddleware", () => {
  it("passes requests through via next() when Studio is disabled", () => {
    const middleware = new MastraStudioMiddleware({ studio: false });
    const next = vi.fn();

    middleware.use(
      {} as express.Request,
      {} as express.Response,
      next as express.NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("serves injected HTML for /, /index.html, and SPA routes, immutable assets, 404 for missing assets, and SSE refresh-events", async () => {
    const middleware = new MastraStudioMiddleware({
      api: { prefix: "/api/mastra" },
      studio: {
        enabled: true,
        hideCloudCta: false,
        telemetryDisabled: false,
      },
    });
    const server = await startMiddlewareServer(middleware);

    try {
      // Explicit /index.html must serve the injected HTML rather than the raw template
      const indexHtmlRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/index.html`,
      );
      expect(indexHtmlRes.status).toBe(200);
      expect(indexHtmlRes.headers.get("content-type")).toContain("text/html");
      expect(indexHtmlRes.headers.get("cache-control")).toBe("no-cache");
      const indexHtml = await indexHtmlRes.text();
      expect(indexHtml).toContain("window.MASTRA_API_PREFIX = '/api/mastra';");
      expect(indexHtml).toContain("window.MASTRA_HIDE_CLOUD_CTA = 'false';");
      expect(indexHtml).toContain(
        "window.MASTRA_TELEMETRY_DISABLED = 'false';",
      );
      expect(indexHtml).not.toContain("%%MASTRA_");

      // Bundled asset under assets/ receives immutable Cache-Control header
      const assetPath = findFirstStudioAssetPath();
      expect(assetPath).toBeDefined();
      const assetRes = await fetch(
        `${server.baseUrl}/api/mastra/studio${assetPath ?? ""}`,
      );
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );

      // Missing file with extension returns 404 instead of SPA HTML
      const missingPngRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/missing-logo.png`,
      );
      expect(missingPngRes.status).toBe(404);

      const missingDistAssetRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/dist/assets/chunk`,
      );
      expect(missingDistAssetRes.status).toBe(404);

      // SSE refresh-events endpoint streams initial connected payload and cleans up on abort
      const abortController = new AbortController();
      const sseRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/refresh-events`,
        { signal: abortController.signal },
      );
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
      const reader = sseRes.body?.getReader();
      expect(reader).toBeDefined();
      const firstChunk = await reader?.read();
      const decoded = new TextDecoder().decode(firstChunk?.value);
      expect(decoded).toContain("data: connected");
      abortController.abort();
      await reader?.cancel().catch(() => undefined);
    } finally {
      await server.close();
    }
  });
});
