import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";

export interface MemberFormProps {
  member: NonNullable<GetMemberFromMemberRouteQuery["member"]>;
  disabled: boolean;
  /** Runs one write, then refreshes the route or leaves it after self-authorization changes. */
  onSave: (
    operation: () => Promise<unknown>,
    changesAuthorization?: boolean,
  ) => Promise<boolean>;
}
