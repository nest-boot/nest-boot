import fs, { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { Logger, RequestMethod } from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import express from "express";

import {
  MastraStudioMiddleware,
  resolveMastraStudioDistDir,
} from "./mastra-studio.middleware.js";

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
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

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

      const faviconRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/mastra-dark-tile.svg`,
      );
      expect(faviconRes.status).toBe(200);
      expect(faviconRes.headers.get("cache-control")).not.toContain(
        "immutable",
      );

      const spaRes = await fetch(
        `${server.baseUrl}/api/mastra/studio/agents/writer-agent`,
      );
      expect(spaRes.status).toBe(200);
      expect(await spaRes.text()).toBe(indexHtml);

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
      const heartbeatIndex = setIntervalSpy.mock.calls.findIndex(
        ([, timeout]) => timeout === 30_000,
      );
      expect(heartbeatIndex).toBeGreaterThanOrEqual(0);
      heartbeatTimer = setIntervalSpy.mock.results[heartbeatIndex]?.value;
      const reader = sseRes.body?.getReader();
      expect(reader).toBeDefined();
      const firstChunk = await reader?.read();
      const decoded = new TextDecoder().decode(firstChunk?.value);
      expect(decoded).toContain("data: connected");
      vi.advanceTimersByTime(30_000);
      const heartbeat = await reader?.read();
      expect(new TextDecoder().decode(heartbeat?.value)).toContain(
        ": ping\n\n",
      );
      abortController.abort();
      await reader?.cancel().catch(() => undefined);
    } finally {
      try {
        await server.close();
        if (heartbeatTimer) {
          await vi.waitFor(() => {
            expect(clearIntervalSpy).toHaveBeenCalledWith(heartbeatTimer);
          });
        }
      } finally {
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
        vi.useRealTimers();
      }
    }
  });

  it("gracefully skips Studio when the optional mastra package or index.html is unavailable", () => {
    expect(
      resolveMastraStudioDistDir(() => {
        throw new Error("Cannot find package 'mastra'");
      }),
    ).toBeNull();

    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    try {
      const middleware = new MastraStudioMiddleware({});
      middleware.onApplicationBootstrap();
      const next = vi.fn();
      middleware.use(
        {} as express.Request,
        {} as express.Response,
        next as express.NextFunction,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('optional "mastra" peer dependency'),
      );
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      existsSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("pre-initializes during onApplicationBootstrap and respects globalPrefix exclude rules", async () => {
    const applicationConfig = new ApplicationConfig();
    applicationConfig.setGlobalPrefix("v1");
    applicationConfig.setGlobalPrefixOptions({
      exclude: [
        {
          path: "/api/mastra/studio",
          pathRegex: /^\/api\/mastra\/studio(?:\/.*)?$/,
          requestMethod: RequestMethod.GET,
        },
        {
          path: "/ignored-post-only",
          pathRegex: /^\/api\/mastra\/agents$/,
          requestMethod: RequestMethod.POST,
        },
      ],
    });

    const readSpy = vi.spyOn(fs, "readFileSync");
    const middleware = new MastraStudioMiddleware({}, applicationConfig);

    try {
      middleware.onApplicationBootstrap();
      const readsAfterBootstrap = readSpy.mock.calls.length;
      expect(readsAfterBootstrap).toBeGreaterThan(0);

      const server = await startMiddlewareServer(middleware);
      try {
        // Studio is excluded from globalPrefix (/api/mastra/studio), while API stays under /v1/api/mastra
        const res = await fetch(`${server.baseUrl}/api/mastra/studio`);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('<base href="/api/mastra/studio/" />');
        expect(html).toContain("window.MASTRA_API_PREFIX = '/v1/api/mastra';");
        expect(html).toContain(
          "window.MASTRA_STUDIO_BASE_PATH = '/api/mastra/studio';",
        );

        // Serving requests reuses the pre-built router without re-reading index.html
        expect(readSpy.mock.calls.length).toBe(readsAfterBootstrap);
      } finally {
        await server.close();
      }
    } finally {
      readSpy.mockRestore();
    }
  });
});
