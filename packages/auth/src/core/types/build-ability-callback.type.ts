import type { BuildAbilityContext } from "../interfaces/build-ability-context.interface.js";

/** Synchronously configures native CASL rules using the request's effective permissions. */
export type BuildAbilityCallback<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> = (context: BuildAbilityContext<UserPermission, WorkspacePermission>) => void;
