import { Mastra } from "@mastra/core/mastra";
import {
  AuthService,
  CustomRouteService,
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
import { Can } from "@nest-boot/auth";
import {
  All,
  Controller,
  Inject,
  NotFoundException,
  PayloadTooLargeException,
  Req,
  Res,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";

import {
  MASTRA_MODULE_OPTIONS,
  type MastraModuleOptions,
  normalizeMastraApiOptions,
} from "./mastra.module-definition.js";

const DANGEROUS_QUERY_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const BODY_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface RequestWithMastraMetadata extends Request {
  mastraRawBodySize?: number;
}

/**
 * Strips the configured Mastra API prefix from an incoming request path.
 * @param requestPath - Express request path
 * @param prefix - Configured Mastra API prefix
 * @returns Mastra-relative route path, or null when outside the prefix
 */
function getMastraRoutePath(
  requestPath: string,
  prefix?: string,
): string | null {
  let normalizedPrefix = prefix ?? "";
  if (normalizedPrefix && !normalizedPrefix.startsWith("/")) {
    normalizedPrefix = `/${normalizedPrefix}`;
  }
  if (normalizedPrefix.endsWith("/")) {
    normalizedPrefix = normalizedPrefix.slice(0, -1);
  }

  let routePath = requestPath;
  if (normalizedPrefix) {
    if (
      requestPath !== normalizedPrefix &&
      !requestPath.startsWith(`${normalizedPrefix}/`)
    ) {
      return null;
    }
    routePath = requestPath.slice(normalizedPrefix.length);
    if (routePath && !routePath.startsWith("/")) {
      routePath = `/${routePath}`;
    }
  }

  return routePath || "/";
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
@Controller()
@Can("manage", Mastra)
@UseInterceptors(
  RequestTrackingInterceptor,
  TracingInterceptor,
  StreamingInterceptor,
)
@UseFilters(MastraExceptionFilter)
export class MastraController {
  private readonly apiEnabled: boolean;

  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    moduleOptions: MastraModuleOptions,
    @Inject(MASTRA_OPTIONS)
    private readonly options: MastraCoreModuleOptions,
    private readonly routeHandler: RouteHandlerService,
    private readonly requestContext: RequestContextService,
    private readonly customRoutes: CustomRouteService,
    private readonly authService: AuthService,
    private readonly throttleGuard: MastraThrottleGuard,
  ) {
    this.apiEnabled = normalizeMastraApiOptions(moduleOptions.api).enabled;
  }

  /**
   * Dispatches incoming requests to matched Mastra server routes or custom API routes.
   * @param req - Incoming Express request
   * @param res - Outgoing Express response
   * @returns Mastra route handler result for StreamingInterceptor
   */
  @All(["", "{*path}"])
  async handleRequest(
    @Req() req: RequestWithMastraMetadata,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const requestPath = req.path;
    const method = req.method.toUpperCase();

    if (!this.apiEnabled) {
      throw new NotFoundException(`Route not found: ${method} ${requestPath}`);
    }
    const routePath = getMastraRoutePath(requestPath, this.options.prefix);
    const matchResult =
      routePath && !routePath.includes("//")
        ? this.routeHandler.matchRoute(method, routePath)
        : null;

    if (!matchResult) {
      const requestContext = this.requestContext.requestContext;
      const handledCustomRoute = await this.customRoutes.handle(
        req,
        res,
        requestContext,
        async (customRoute, requiresAuth, pathParams) => {
          if (this.authService.isEnabled()) {
            const user = await this.authService.authenticate(req, {
              requestContext,
              response: res,
              requiresAuth,
              customRoute: true,
            });
            if (user !== undefined) {
              this.requestContext.setUser(user);
            }
          }

          const serverRoute = {
            method: customRoute.method,
            path: customRoute.path,
            responseType: "json" as const,
            handler: () => Promise.resolve(undefined),
            requiresAuth,
            requiresPermission: customRoute.requiresPermission,
            fga: customRoute.fga,
          };

          if (requiresAuth) {
            await this.routeHandler.enforceRoutePermission(
              serverRoute,
              requestContext,
            );
          }

          if (customRoute.fga) {
            await this.routeHandler.enforceRouteFGA(
              serverRoute,
              requestContext,
              {
                ...(typeof req.body === "object" && req.body !== null
                  ? (req.body as Record<string, unknown>)
                  : {}),
                ...(req.query as Record<string, unknown>),
                ...pathParams,
              },
            );
          }
        },
      );

      if (handledCustomRoute) {
        return;
      }

      throw new NotFoundException(`Route not found: ${method} ${requestPath}`);
    }

    const { route, pathParams } = matchResult;

    if (this.authService.isEnabled()) {
      const user = await this.authService.authenticate(req, {
        requestContext: this.requestContext.requestContext,
        bearerOnly: route.authTransport === "bearer",
        response: res,
        requiresAuth: route.requiresAuth,
      });
      if (user !== undefined) {
        this.requestContext.setUser(user);
      }
    }

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
