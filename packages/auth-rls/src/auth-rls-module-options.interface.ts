import { RouteInfo, Type } from "@nestjs/common/interfaces";

import { AuthRlsContext } from "./auth-rls.context";

/** Middleware registration options for the auth-rls module. */
export interface AuthRlsModuleMiddlewareOptions {
  /** Whether to register the RLS middleware automatically. */
  register?: boolean;
  /** Routes to include for RLS middleware. */
  includeRoutes?: (string | RouteInfo | Type)[];
  /** Routes to exclude from RLS middleware. */
  excludeRoutes?: (string | RouteInfo)[];
}

/** Configuration options for {@link AuthRlsModule}. */
export interface AuthRlsModuleOptions {
  /** Factory function that populates additional RLS context variables. */
  context?: (ctx: AuthRlsContext) => AuthRlsContext | Promise<AuthRlsContext>;

  /** Middleware registration options. */
  middleware?: AuthRlsModuleMiddlewareOptions;
}
