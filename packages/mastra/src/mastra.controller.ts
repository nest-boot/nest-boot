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

import { MastraManager } from "./mastra.manager.js";
import {
  DEFAULT_MASTRA_SERVER_PREFIX,
  MASTRA_MODULE_OPTIONS,
  type MastraModuleOptions,
  normalizeMastraServerOptions,
} from "./mastra.module-definition.js";
import {
  assertCanExposeMastraTool,
  canExposeMastraTool,
  runWithPreflightApprovedTool,
} from "./tool-guard.js";

const DANGEROUS_QUERY_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const BODY_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SERIALIZED_TOOL_STRING_KEYS = [
  "id",
  "title",
  "description",
  "inputSchema",
  "outputSchema",
  "requestContextSchema",
] as const;

/**
 * Checks whether a value is a non-null, non-array plain object record.
 * @param value - Candidate value
 * @returns True when the value is an object record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Projects a serialized Mastra tool payload onto Mastra's public `serializedToolSchema`
 * fields so injected NestJS dependencies or internal tool properties are never exposed.
 * @param value - Raw serialized tool object
 * @returns Public serialized tool metadata
 */
function projectSerializedTool(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const projected: Record<string, unknown> = {};
  for (const key of SERIALIZED_TOOL_STRING_KEYS) {
    if (typeof value[key] === "string") {
      projected[key] = value[key];
    }
  }
  if (typeof value.requireApproval === "boolean") {
    projected.requireApproval = value.requireApproval;
  }
  return projected;
}

/**
 * Projects nested `tools` maps inside a serialized Mastra agent object onto public metadata.
 * @param agentPayload - Serialized agent object
 * @returns Serialized agent with sanitized `tools` entries
 */
function projectSerializedAgent(agentPayload: unknown): unknown {
  if (!isRecord(agentPayload) || !isRecord(agentPayload.tools)) {
    return agentPayload;
  }

  const projectedTools: Record<string, unknown> = {};
  for (const [key, toolValue] of Object.entries(agentPayload.tools)) {
    projectedTools[key] = projectSerializedTool(toolValue);
  }
  return {
    ...agentPayload,
    tools: projectedTools,
  };
}

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
    @Optional() private readonly mastraManager?: MastraManager,
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

    const rawQueryParams = parseQueryParams(req.query);
    const pathParamRecord =
      typeof pathParams === "object" && pathParams !== null
        ? (pathParams as Record<string, unknown>)
        : undefined;
    const pathParamKeys = pathParamRecord
      ? new Set(Object.keys(pathParamRecord))
      : undefined;
    // Prevent untyped query parameters from overwriting route path parameters
    // when `@mastra/nestjs` merges `pathParams` and `queryParams`.
    const queryParams =
      pathParamKeys && pathParamKeys.size > 0
        ? Object.fromEntries(
            Object.entries(rawQueryParams).filter(
              ([key]) => !pathParamKeys.has(key),
            ),
          )
        : rawQueryParams;
    const body = await this.parseBody(req, route.maxBodySize);

    // Tools are singleton DI providers registered at startup (not hot-swapped by ID mid-request).
    const requestedToolId =
      typeof pathParamRecord?.toolId === "string"
        ? pathParamRecord.toolId
        : undefined;
    let preflightApprovedTool: object | undefined;
    if (
      (route.path === "/tools/:toolId" ||
        route.path === "/tools/:toolId/execute") &&
      requestedToolId !== undefined
    ) {
      const matchedTool = this.resolveRouteTargetTool(requestedToolId);
      if (matchedTool) {
        if (method === "GET") {
          if (!(await canExposeMastraTool(matchedTool))) {
            throw new NotFoundException("Tool not found");
          }
        } else if (
          method === "POST" &&
          route.path === "/tools/:toolId/execute"
        ) {
          await assertCanExposeMastraTool(matchedTool);
          if (typeof matchedTool === "object") {
            preflightApprovedTool = matchedTool;
          }
        }
      }
    }

    const executeRoute = () =>
      this.routeHandler.executeHandler(route, {
        pathParams,
        queryParams,
        body,
        requestContext: this.requestContext.requestContext,
        abortSignal: this.requestContext.abortSignal,
        request: toWebRequest(req),
      });
    const isToolExecutePost =
      method === "POST" &&
      (route.path === "/tools/:toolId/execute" ||
        route.path === "/agents/:agentId/tools/:toolId/execute");
    const result =
      isToolExecutePost || preflightApprovedTool
        ? await runWithPreflightApprovedTool(
            {
              tool: preflightApprovedTool,
              targetToolId: requestedToolId,
            },
            executeRoute,
          )
        : await executeRoute();

    if (
      method === "GET" &&
      isRecord(result) &&
      result.responseType === "json" &&
      isRecord(result.data)
    ) {
      if (route.path === "/tools") {
        return {
          ...result,
          data: await this.filterAndProjectSerializedTools(result.data),
        };
      }
      if (
        route.path === "/tools/:toolId" ||
        route.path === "/agents/:agentId/tools/:toolId"
      ) {
        return {
          ...result,
          data: projectSerializedTool(result.data),
        };
      }
      if (route.path === "/agents") {
        const projectedAgents: Record<string, unknown> = {};
        for (const [key, agentPayload] of Object.entries(result.data)) {
          projectedAgents[key] = projectSerializedAgent(agentPayload);
        }
        return {
          ...result,
          data: projectedAgents,
        };
      }
      if (route.path === "/agents/:agentId") {
        return {
          ...result,
          data: projectSerializedAgent(result.data),
        };
      }
    }

    return result;
  }

  private resolveRouteTargetTool(toolId: string): unknown {
    const registeredTools = this.options.tools;
    if (registeredTools) {
      const fromOptions = Object.values(registeredTools).find(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "id" in candidate &&
          candidate.id === toolId,
      );
      if (fromOptions) {
        return fromOptions;
      }
    }
    return this.mastraManager?.getTool(toolId);
  }

  private resolveListedTool(
    key: string,
    serialized: unknown,
    seenOptionToolIds: ReadonlySet<string>,
  ): unknown {
    const registeredTools = this.options.tools;
    const hasOptionKey = Boolean(
      registeredTools && Object.hasOwn(registeredTools, key),
    );
    const byRegistrationKey =
      typeof this.mastraManager?.getToolByRegistrationKey === "function"
        ? this.mastraManager.getToolByRegistrationKey(key)
        : undefined;

    if (byRegistrationKey !== undefined) {
      const regToolId =
        typeof byRegistrationKey.id === "string"
          ? byRegistrationKey.id
          : undefined;
      if (regToolId === undefined || !seenOptionToolIds.has(regToolId)) {
        return byRegistrationKey;
      }
    }

    if (hasOptionKey && registeredTools) {
      return registeredTools[key];
    }

    if (byRegistrationKey !== undefined) {
      return byRegistrationKey;
    }

    const serializedId =
      isRecord(serialized) && typeof serialized.id === "string"
        ? serialized.id
        : undefined;
    if (serializedId !== undefined) {
      const bySerializedId = this.resolveRouteTargetTool(serializedId);
      if (bySerializedId !== undefined) {
        return bySerializedId;
      }
    }
    return this.resolveRouteTargetTool(key);
  }

  private async filterAndProjectSerializedTools(
    serializedTools: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const seenOptionToolIds = new Set<string>();
    for (const candidate of Object.values(this.options.tools ?? {})) {
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        "id" in candidate &&
        typeof candidate.id === "string"
      ) {
        seenOptionToolIds.add(candidate.id);
      }
    }

    const entries = Object.entries(serializedTools);
    const decisions = await Promise.all(
      entries.map(async ([key, serialized]) => {
        const targetTool = this.resolveListedTool(
          key,
          serialized,
          seenOptionToolIds,
        );
        const allowed = await canExposeMastraTool(targetTool);
        return [key, serialized, allowed] as const;
      }),
    );

    const filtered: Record<string, unknown> = {};
    for (const [key, serialized, allowed] of decisions) {
      if (allowed) {
        filtered[key] = projectSerializedTool(serialized);
      }
    }
    return filtered;
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
