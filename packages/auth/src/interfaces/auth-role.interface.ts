/** One configured role and the flattened permissions it grants. */
export interface AuthRole {
  /** Stable role name stored on the user or workspace member. */
  name: string;
  /** Flattened `resource:action` permissions granted by the role. */
  permissions: string[];
}
