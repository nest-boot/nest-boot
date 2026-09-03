import { createContext, useContext } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";

const GET_CURRENT_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_CONTEXT = graphql(`
  query getCurrentWorkspaceMemberFromWorkspaceMemberContext {
    currentWorkspaceMember {
      id
      roles
      name
      email
      permissions
      status
      user {
        email
      }
    }
  }
`);

const CurrentWorkspaceMemberContext = createContext<
  | GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery["currentWorkspaceMember"]
  | null
>(null);

export function CurrentWorkspaceMemberProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = useSuspenseQuery(
    GET_CURRENT_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_CONTEXT,
    { fetchPolicy: "network-only" },
  );

  return (
    <CurrentWorkspaceMemberContext value={data.currentWorkspaceMember}>
      {children}
    </CurrentWorkspaceMemberContext>
  );
}

export function useCurrentWorkspaceMemberContext() {
  const context = useContext(CurrentWorkspaceMemberContext);

  if (context == null) {
    throw new Error(
      "useCurrentWorkspaceMemberContext must be used within a CurrentWorkspaceMemberContext",
    );
  }
  return context;
}
