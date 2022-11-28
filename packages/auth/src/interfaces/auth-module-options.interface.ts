import { RouteInfo } from "@nestjs/common/interfaces";
import { Type } from "@nestjs/common/interfaces/type.interface";

export interface AuthModuleOptions {
  includeRoutes?: Array<string | Type<any> | RouteInfo>;
  excludeRoutes?: Array<string | RouteInfo>;
}
