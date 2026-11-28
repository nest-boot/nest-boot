import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  escapeStudioHtmlValue,
  injectStudioHtmlConfig,
  normalizeStudioBase,
} from "@mastra/deployer/build";
import {
  Inject,
  Injectable,
  Logger,
  type NestMiddleware,
  type OnApplicationBootstrap,
  Optional,
  RequestMethod,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from "express";

import type { MastraModuleOptions } from "./interfaces/mastra-module-options.interface.js";
import { MASTRA_MODULE_OPTIONS } from "./mastra.module-definition.js";
import {
  normalizeMastraServerOptions,
  normalizeMastraStudioOptions,
  resolveMastraStudioBasePath,
} from "./utils/normalize-mastra-options.util.js";

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves the bundled `mastra/dist/studio` directory path when the optional
 * `mastra` peer dependency is installed.
 * @param resolvePackage - Package specifier resolver (overridable for tests)
 * @returns Absolute path to the Mastra Studio distribution directory, or `null` when unavailable
 */
export function resolveMastraStudioDistDir(
  resolvePackage: (specifier: string) => string = (specifier) =>
    requireFromHere.resolve(specifier),
): string | null {
  try {
    const mastraPkgPath = resolvePackage("mastra/package.json");
    return path.join(path.dirname(mastraPkgPath), "dist", "studio");
  } catch {
    return null;
  }
}

/**
 * Checks whether a route path is excluded from NestJS's configured global prefix.
 * @param applicationConfig - NestJS application configuration
 * @param routePath - Candidate route path without global prefix
 * @param method - HTTP request method to match against exclude rules
 * @returns True when the route matches a global prefix exclude entry
 */
function isGlobalPrefixExcluded(
  applicationConfig: ApplicationConfig | undefined,
  routePath: string,
  method: RequestMethod,
): boolean {
  const excludedRoutes = applicationConfig?.getGlobalPrefixOptions().exclude;
  if (!Array.isArray(excludedRoutes) || excludedRoutes.length === 0) {
    return false;
  }

  const normalizedPath = routePath.startsWith("/")
    ? routePath
    : `/${routePath}`;
  return excludedRoutes.some((route) => {
    const matchesMethod =
      route.requestMethod === RequestMethod.ALL ||
      route.requestMethod === method;
    if (!matchesMethod) {
      return false;
    }

    return route.pathRegex.test(normalizedPath);
  });
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
export class MastraStudioMiddleware
  implements NestMiddleware, OnApplicationBootstrap
{
  private readonly logger = new Logger(MastraStudioMiddleware.name);
  private router: Router | null | undefined;

  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    private readonly options: MastraModuleOptions,
    @Optional() private readonly applicationConfig?: ApplicationConfig,
  ) {}

  /**
   * Pre-builds the Studio router once NestJS has finished applying global prefix options,
   * avoiding synchronous file I/O on the first incoming HTTP request.
   */
  onApplicationBootstrap(): void {
    this.ensureRouter();
  }

  private ensureRouter(): Router | null {
    if (this.router === undefined) {
      this.router = this.createRouter();
    }
    return this.router;
  }

  /**
   * Builds the Studio router after the host has configured its global prefix.
   * @returns Mounted Studio router, or null when Studio is unavailable
   */
  private createRouter(): Router | null {
    const { enabled: serverEnabled, serverOptions } =
      normalizeMastraServerOptions(this.options.server);
    const studioOptions = normalizeMastraStudioOptions(
      this.options.studio,
      serverEnabled,
    );

    if (!studioOptions.enabled) {
      return null;
    }

    const studioDir = resolveMastraStudioDistDir();
    const indexPath = studioDir ? path.join(studioDir, "index.html") : null;

    if (!studioDir || !indexPath || !fs.existsSync(indexPath)) {
      this.logger.warn(
        'Mastra Studio is enabled, but the optional "mastra" peer dependency (dist/studio/index.html) was not found. Install "mastra" to serve embedded Studio.',
      );
      return null;
    }

    const globalPrefix = normalizeStudioBase(
      this.applicationConfig?.getGlobalPrefix() ?? "",
    );
    const rawApiPrefix = serverOptions.prefix;
    const rawStudioBasePath = resolveMastraStudioBasePath(rawApiPrefix);
    const apiExcluded =
      globalPrefix.length > 0 &&
      (isGlobalPrefixExcluded(
        this.applicationConfig,
        rawApiPrefix,
        RequestMethod.ALL,
      ) ||
        isGlobalPrefixExcluded(
          this.applicationConfig,
          `${rawApiPrefix}/agents`,
          RequestMethod.GET,
        ));
    const studioExcluded =
      globalPrefix.length > 0 &&
      isGlobalPrefixExcluded(
        this.applicationConfig,
        rawStudioBasePath,
        RequestMethod.GET,
      );
    const apiPrefix =
      globalPrefix && !apiExcluded
        ? `${globalPrefix}${rawApiPrefix}`
        : rawApiPrefix;
    const studioBasePath =
      globalPrefix && !studioExcluded
        ? `${globalPrefix}${rawStudioBasePath}`
        : rawStudioBasePath;
    const devServerInstanceId = randomUUID();

    const renderedIndexHtml = injectStudioHtmlConfig(
      fs.readFileSync(indexPath, "utf8"),
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
    return mountedRouter;
  }

  /**
   * Delegates incoming Studio requests to the mounted Express router.
   * @param req - Incoming Express request
   * @param res - Outgoing Express response
   * @param next - Next middleware callback
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const router = this.ensureRouter();
    if (!router) {
      next();
      return;
    }

    void router(req, res, next);
  }
}
