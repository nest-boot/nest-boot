import { createContext, useContext, useMemo } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentMemberFromMemberContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";
import { createAbility } from "@/lib/ability";

const GET_CURRENT_MEMBER_FROM_MEMBER_CONTEXT = graphql(`
  query getCurrentMemberFromMemberContext {
    currentMember {
      id
      roles
      permissions
      status
      name
      email
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

const CurrentMemberContext = createContext<
  GetCurrentMemberFromMemberContextQuery["currentMember"] | null
>(null);
const CurrentWorkspaceAbilityContext = createContext<ReturnType<
  typeof createAbility
> | null>(null);

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const { data } = useSuspenseQuery(GET_CURRENT_MEMBER_FROM_MEMBER_CONTEXT, {
    fetchPolicy: "network-only",
  });
  const ability = useMemo(
    () => createAbility(data.currentWorkspaceAbilityRules),
    [data.currentWorkspaceAbilityRules],
  );

  return (
    <CurrentMemberContext value={data.currentMember}>
      <CurrentWorkspaceAbilityContext value={ability}>
        {children}
      </CurrentWorkspaceAbilityContext>
    </CurrentMemberContext>
  );
}

export function useCurrentWorkspaceAbility() {
  const ability = useContext(CurrentWorkspaceAbilityContext);

  if (ability == null) {
    throw new Error(
      "useCurrentWorkspaceAbility must be used within a CurrentMemberProvider",
    );
  }

  return ability;
}

export function useCurrentMemberContext() {
  const context = useContext(CurrentMemberContext);

  if (context == null) {
    throw new Error(
      "useCurrentMemberContext must be used within a CurrentMemberContext",
    );
  }
  return context;
}
