export const DEFAULT_MASTRA_SERVER_PREFIX = "/api/mastra";

export const MASTRA_CONTROLLER_TYPE = Symbol("MASTRA_CONTROLLER_TYPE");

export const UNSUPPORTED_SERVER_KEYS = [
  "auth",
  "customRouteAuthConfig",
  "port",
  "host",
  "apiRoutes",
  "middleware",
  "cors",
  "apiPrefix",
] as const;
