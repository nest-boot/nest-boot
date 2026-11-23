import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  escapeStudioHtmlValue,
  injectStudioHtmlConfig,
} from "@mastra/deployer/build";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from "express";

import {
  MASTRA_MODULE_OPTIONS,
  type MastraModuleOptions,
  normalizeMastraApiOptions,
  normalizeMastraStudioOptions,
  resolveMastraStudioBasePath,
} from "./mastra.module-definition.js";

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves the bundled `mastra/dist/studio` directory path.
 * @returns Absolute path to the Mastra Studio distribution directory
 */
function resolveMastraStudioDistDir(): string {
  const mastraPkgPath = requireFromHere.resolve("mastra/package.json");
  return path.join(path.dirname(mastraPkgPath), "dist", "studio");
}

/**
 * Checks whether an unmatched Studio relative path looks like a missing static asset.
 * @param relativePath - Request path relative to the Studio base path
 * @returns True when the path should return 404 instead of SPA `index.html`
 */
function looksLikeMissingAsset(relativePath: string): boolean {
  if (
    relativePath.startsWith("/assets/") ||
    relativePath.startsWith("/dist/assets/")
  ) {
    return true;
  }

  return /\.[a-z0-9]{1,8}$/i.test(relativePath);
}

/**
 * Express-backed NestJS middleware serving bundled Mastra Studio assets and SPA HTML
 * at `${prefix}/studio` without requiring route-level authentication (matching GraphQL Playground).
 */
@Injectable()
export class MastraStudioMiddleware implements NestMiddleware {
  private readonly router: Router | null;

  constructor(@Inject(MASTRA_MODULE_OPTIONS) options: MastraModuleOptions) {
    const { enabled: apiEnabled, serverOptions } = normalizeMastraApiOptions(
      options.api,
    );
    const studioOptions = normalizeMastraStudioOptions(
      options.studio,
      apiEnabled,
    );
    const studioDir = resolveMastraStudioDistDir();
    const indexPath = path.join(studioDir, "index.html");

    if (!studioOptions.enabled || !existsSync(indexPath)) {
      this.router = null;
      return;
    }

    const apiPrefix = serverOptions.prefix;
    const studioBasePath = resolveMastraStudioBasePath(apiPrefix);
    const devServerInstanceId = randomUUID();

    const renderedIndexHtml = injectStudioHtmlConfig(
      readFileSync(indexPath, "utf8"),
      {
        basePath: studioBasePath,
        host: "window.location.hostname",
        port: "(window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))",
        protocol: "window.location.protocol.slice(0, -1)",
        apiPrefix: `'${escapeStudioHtmlValue(apiPrefix)}'`,
        cloudApiEndpoint: `''`,
        autoDetectUrl: `'true'`,
        hideCloudCta: `'${studioOptions.hideCloudCta ? "true" : "false"}'`,
        telemetryDisabled: `'${studioOptions.telemetryDisabled ? "true" : "false"}'`,
        experimentalFeatures: `'false'`,
        templates: `'false'`,
        requestContextPresets: `''`,
        experimentalUI: `'false'`,
        agentSignals: `'true'`,
        signalsUI: `'false'`,
        organizationId: `''`,
        platformProjectId: `''`,
        platformObservabilityEndpoint: `''`,
        devServerInstanceId: `'${escapeStudioHtmlValue(devServerInstanceId)}'`,
      },
    );

    const studioRouter = express.Router();

    studioRouter.get("/refresh-events", (req: Request, res: Response) => {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      res.write(`id: ${devServerInstanceId}\ndata: connected\n\n`);

      const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
          res.write(": ping\n\n");
        }
      }, 30_000);
      keepAlive.unref();

      const cleanup = () => {
        clearInterval(keepAlive);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", cleanup);
      res.on("close", cleanup);
    });

    const sendRenderedIndexHtml = (res: Response) => {
      res
        .status(200)
        .type("html")
        .set("Cache-Control", "no-cache")
        .send(renderedIndexHtml);
    };

    studioRouter.get(["/", "/index.html"], (_req: Request, res: Response) => {
      sendRenderedIndexHtml(res);
    });

    studioRouter.use(
      express.static(studioDir, {
        index: false,
        redirect: false,
        fallthrough: true,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          }
        },
      }),
    );

    studioRouter.get("/{*path}", (req: Request, res: Response) => {
      if (looksLikeMissingAsset(req.path)) {
        res.status(404).end();
        return;
      }

      sendRenderedIndexHtml(res);
    });

    const mountedRouter = express.Router();
    mountedRouter.use(studioBasePath, studioRouter);
    this.router = mountedRouter;
  }

  /**
   * Delegates incoming Studio requests to the mounted Express router.
   * @param req - Incoming Express request
   * @param res - Outgoing Express response
   * @param next - Next middleware callback
   */
  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.router) {
      next();
      return;
    }

    void this.router(req, res, next);
  }
}
