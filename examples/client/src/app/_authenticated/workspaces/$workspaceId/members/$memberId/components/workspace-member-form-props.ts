import type { GetWorkspaceMemberFromWorkspaceMemberRouteQuery } from "@/gql/graphql";

export interface WorkspaceMemberFormProps {
  member: NonNullable<
    GetWorkspaceMemberFromWorkspaceMemberRouteQuery["workspaceMember"]
  >;
  disabled: boolean;
  /** Runs one write, then refreshes the route or leaves it after self-authorization changes. */
  onSave: (
    operation: () => Promise<unknown>,
    changesAuthorization?: boolean,
  ) => Promise<boolean>;
}
