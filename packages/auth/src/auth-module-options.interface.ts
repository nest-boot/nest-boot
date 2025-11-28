import { Loaded } from "@mikro-orm/core";
import { RouteInfo, Type } from "@nestjs/common/interfaces";
import { BetterAuthOptions } from "better-auth";
import { Request, Response } from "express";

import { MikroOrmAdapterConfig } from "./adapters/mikro-orm-adapter";
import { BaseSession, BaseUser } from "./entities";

export interface AuthModuleMiddlewareOptions {
  register?: boolean;
  includeRoutes?: (string | RouteInfo | Type)[];
  excludeRoutes?: (string | RouteInfo)[];
}

export interface AuthModuleOptions extends Omit<BetterAuthOptions, "database"> {
  basePath?: string;

  entities: MikroOrmAdapterConfig["entities"];

  middleware?: AuthModuleMiddlewareOptions;

  onAuthenticated?: (context: {
    req: Request;
    res: Response;
    user: Loaded<BaseUser> | null;
    session: Loaded<BaseSession> | null;
  }) => void | Promise<void>;
}
