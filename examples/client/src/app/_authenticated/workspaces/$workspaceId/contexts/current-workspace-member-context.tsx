import { createContext, useContext, useMemo } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";
import { createAbility } from "@/lib/ability";

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
    currentWorkspaceAbilityRules {
      actions
      subjects
      fields
      conditions
      inverted
      reason
    }
  }
`);

const CurrentWorkspaceMemberContext = createContext<
  | GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery["currentWorkspaceMember"]
  | null
>(null);
const CurrentWorkspaceAbilityContext = createContext<ReturnType<
  typeof createAbility
> | null>(null);

export function CurrentWorkspaceMemberProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = useSuspenseQuery(
    GET_CURRENT_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_CONTEXT,
    { fetchPolicy: "network-only" },
  );
  const ability = useMemo(
    () => createAbility(data.currentWorkspaceAbilityRules),
    [data.currentWorkspaceAbilityRules],
  );

  return (
    <CurrentWorkspaceMemberContext value={data.currentWorkspaceMember}>
      <CurrentWorkspaceAbilityContext value={ability}>
        {children}
      </CurrentWorkspaceAbilityContext>
    </CurrentWorkspaceMemberContext>
  );
}

export function useCurrentWorkspaceAbility() {
  const ability = useContext(CurrentWorkspaceAbilityContext);

  if (ability == null) {
    throw new Error(
      "useCurrentWorkspaceAbility must be used within a CurrentWorkspaceMemberProvider",
    );
  }

  return ability;
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
