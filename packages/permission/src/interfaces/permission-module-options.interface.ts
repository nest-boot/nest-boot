import type { Request, Response } from "express";

import type { PermissionAbility } from "../types/permission-ability.type";

/** Request context passed to the ability builder for the current request. */
export interface PermissionRequestContext {
  /** Express request object. */
  req: Request;
  /** Express response object. */
  res: Response;
}

/** Callback used to build the permission ability for the current request. */
export type BuildAbilityCallback = (
  ctx: PermissionRequestContext,
) => PermissionAbility | null | Promise<PermissionAbility | null>;

/** Permission module options. */
export interface PermissionModuleOptions {
  /** Builds a permission ability from the current request context. */
  buildAbility: BuildAbilityCallback;
}
