import { RouteInfo, Type } from "@nestjs/common/interfaces";
import { BetterAuthOptions } from "better-auth";

import { MikroOrmAdapterConfig } from "./adapters/mikro-orm-adapter";

/** Options for configuring auth middleware route registration. */
export interface AuthModuleMiddlewareOptions {
  /** Whether to register the auth middleware (defaults to true). */
  register?: boolean;
  /** Routes to include in auth middleware processing. */
  includeRoutes?: (string | RouteInfo | Type)[];
  /** Routes to exclude from auth middleware processing. */
  excludeRoutes?: (string | RouteInfo)[];
}

/** Configuration options for the AuthModule. */
export interface AuthModuleOptions extends Omit<BetterAuthOptions, "database"> {
  /** Base path for the auth API endpoints. */
  basePath?: string;

  /** Entity classes used for authentication. */
  entities: MikroOrmAdapterConfig["entities"];

  /** Middleware registration options. */
  middleware?: AuthModuleMiddlewareOptions;

  /** Callback invoked after successful authentication. */
  onAuthenticated?: () => void | Promise<void>;
}
