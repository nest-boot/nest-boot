import {
  MASTRA_OPTIONS,
  MastraExceptionFilter,
  type MastraModuleOptions as MastraCoreModuleOptions,
  MastraThrottleGuard,
  parseMultipartFormData,
  RequestContextService,
  RequestTrackingInterceptor,
  RouteHandlerService,
  StreamingInterceptor,
  TracingInterceptor,
} from "@mastra/nestjs";
import {
  All,
  Controller,
  Inject,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  Req,
  Res,
  UseFilters,
  UseInterceptors,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import type { Request, Response } from "express";

import {
  DEFAULT_MASTRA_SERVER_PREFIX,
  MASTRA_MODULE_OPTIONS,
  type MastraModuleOptions,
  normalizeMastraServerOptions,
} from "./mastra.module-definition.js";

const DANGEROUS_QUERY_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const BODY_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface RequestWithMastraMetadata extends Request {
  mastraRawBodySize?: number;
}

/**
 * Normalizes a route prefix to either empty string or a leading-slash path without trailing slashes.
 * @param prefix - Raw prefix string
 * @returns Normalized route prefix
 */
function normalizeRoutePrefix(prefix?: string): string {
  let normalized = prefix?.trim() ?? "";
  if (normalized && !normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Strips the effective mounted prefix (accounting for NestJS global prefix and Mastra API prefix)
 * from an incoming request path.
 * @param requestPath - Express request path
 * @param prefix - Configured Mastra API prefix
 * @param globalPrefix - Optional NestJS application global prefix
 * @returns Mastra-relative route path, or null when outside the prefix
 */
function getMastraRoutePath(
  requestPath: string,
  prefix?: string,
  globalPrefix?: string,
): string | null {
  const normalizedPrefix = normalizeRoutePrefix(prefix);
  const normalizedGlobalPrefix = normalizeRoutePrefix(globalPrefix);
  const candidatePrefixes = normalizedGlobalPrefix
    ? [`${normalizedGlobalPrefix}${normalizedPrefix}`, normalizedPrefix]
    : [normalizedPrefix];

  for (const candidatePrefix of candidatePrefixes) {
    if (!candidatePrefix) {
      return requestPath || "/";
    }
    if (
      requestPath === candidatePrefix ||
      requestPath.startsWith(`${candidatePrefix}/`)
    ) {
      const routePath = requestPath.slice(candidatePrefix.length);
      return routePath || "/";
    }
  }

  return null;
}

/**
 * Converts an Express request into a Web Fetch `Request` for Mastra handlers.
 * @param req - Incoming Express request
 * @returns Web-standard Request with method and headers
 */
function toWebRequest(req: Request): globalThis.Request {
  const hostHeader = req.get("host");
  const host = hostHeader && hostHeader.length > 0 ? hostHeader : "localhost";
  const url = `${req.protocol || "http"}://${host}${req.originalUrl || req.url}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
    } else {
      headers.set(key, value);
    }
  }

  return new globalThis.Request(url, {
    method: req.method,
    headers,
  });
}

/**
 * Normalizes Express query values to strings or string arrays while filtering unsafe keys.
 * @param query - Express request query object
 * @returns Sanitized query parameter record
 */
function parseQueryParams(query: Request["query"]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    if (key === "requestContext" || DANGEROUS_QUERY_KEYS.has(key)) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

/**
 * NestJS controller exposing Mastra HTTP API routes under the configured prefix
 * (default `/api/mastra`), reusing `@mastra/nestjs` services and interceptors while
 * keeping full control over NestJS routing, guards, and authorization.
 */
@Controller({ path: DEFAULT_MASTRA_SERVER_PREFIX, version: VERSION_NEUTRAL })
@UseInterceptors(
  RequestTrackingInterceptor,
  TracingInterceptor,
  StreamingInterceptor,
)
@UseFilters(MastraExceptionFilter)
export class MastraController {
  private readonly serverEnabled: boolean;

  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    moduleOptions: MastraModuleOptions,
    @Inject(MASTRA_OPTIONS)
    private readonly options: MastraCoreModuleOptions,
    private readonly routeHandler: RouteHandlerService,
    private readonly requestContext: RequestContextService,
    private readonly throttleGuard: MastraThrottleGuard,
    @Optional() private readonly applicationConfig?: ApplicationConfig,
  ) {
    this.serverEnabled = normalizeMastraServerOptions(
      moduleOptions.server,
    ).enabled;
  }

  /**
   * Dispatches incoming requests to matched Mastra API routes.
   * @param req - Incoming Express request
   * @param _res - Outgoing Express response managed by StreamingInterceptor
   * @returns Mastra route handler result for StreamingInterceptor
   */
  @All(["", "{*path}"])
  async handleRequest(
    @Req() req: RequestWithMastraMetadata,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<unknown> {
    const requestPath = req.path;
    const method = req.method.toUpperCase();

    if (!this.serverEnabled) {
      throw new NotFoundException(`Route not found: ${method} ${requestPath}`);
    }
    const routePath = getMastraRoutePath(
      requestPath,
      this.options.prefix,
      this.applicationConfig?.getGlobalPrefix(),
    );
    const matchResult =
      routePath && !routePath.includes("//")
        ? this.routeHandler.matchRoute(method, routePath)
        : null;

    if (!matchResult) {
      throw new NotFoundException(`Route not found: ${method} ${requestPath}`);
    }

    const { route, pathParams } = matchResult;

    if (this.options.rateLimitOptions?.enabled !== false && routePath) {
      const { limit, windowMs } = this.throttleGuard.getRateLimitSettings(
        req,
        undefined,
        routePath,
      );
      await this.throttleGuard.checkLimit(req, limit, windowMs, routePath);
    }

    const queryParams = parseQueryParams(req.query);
    const body = await this.parseBody(req, route.maxBodySize);

    return await this.routeHandler.executeHandler(route, {
      pathParams,
      queryParams,
      body,
      requestContext: this.requestContext.requestContext,
      abortSignal: this.requestContext.abortSignal,
      request: toWebRequest(req),
    });
  }

  private async parseBody(
    req: RequestWithMastraMetadata,
    routeMaxBodySize?: number,
  ): Promise<unknown> {
    if (!BODY_HTTP_METHODS.has(req.method.toUpperCase())) {
      return undefined;
    }

    const contentType = req.headers["content-type"] ?? "";
    if (contentType.includes("multipart/form-data")) {
      return await parseMultipartFormData(req, {
        maxFileSize:
          routeMaxBodySize ?? this.options.bodyLimitOptions?.maxFileSize,
        allowedMimeTypes: this.options.bodyLimitOptions?.allowedMimeTypes,
      });
    }

    if (routeMaxBodySize !== undefined) {
      const rawBodySize = req.mastraRawBodySize;
      const contentLength = Number.parseInt(
        req.headers["content-length"] ?? "",
        10,
      );
      const bodySize =
        rawBodySize ??
        (Number.isNaN(contentLength)
          ? req.body === undefined
            ? 0
            : Buffer.byteLength(JSON.stringify(req.body), "utf8")
          : contentLength);

      if (bodySize > routeMaxBodySize) {
        throw new PayloadTooLargeException("Request body too large");
      }
    }

    return req.body === undefined ? {} : req.body;
  }
}
