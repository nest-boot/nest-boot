/** Common permission actions used by `PermissionAbility`. */
export enum PermissionAction {
  /** Create a resource. */
  CREATE = "create",
  /** Read a resource. */
  READ = "read",
  /** Update a resource. */
  UPDATE = "update",
  /** Delete a resource. */
  DELETE = "delete",
  /** Manage a resource, including all actions. */
  MANAGE = "manage",
}
