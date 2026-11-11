import type { MongoQuery, SubjectType } from "@casl/ability";

/** Restricted extension API; auth owns the builder and the final ability. */
export interface AbilityRules<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> {
  /** Grants a business action only when the principal has the named permission. Built-in auth subjects and `all` are forbidden. */
  can: (
    permission:
      | { user: UserPermission; workspace?: never }
      | { workspace: WorkspacePermission; user?: never },
    action: string | string[],
    subject: SubjectType | SubjectType[],
    fieldsOrConditions?: string | string[] | MongoQuery,
    conditions?: MongoQuery,
  ) => void;
  /** Adds a restriction, including conditions or fields, to business or built-in actions. */
  cannot: (
    action: string | string[],
    subject: SubjectType | SubjectType[],
    fieldsOrConditions?: string | string[] | MongoQuery,
    conditions?: MongoQuery,
  ) => void;
}
