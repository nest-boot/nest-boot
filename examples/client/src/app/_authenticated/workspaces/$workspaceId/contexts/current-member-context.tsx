import { createContext, useContext } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentMemberFromMemberContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";
import { AbilityProvider } from "@/contexts/ability-context";

const GET_CURRENT_MEMBER_FROM_MEMBER_CONTEXT = graphql(`
  query getCurrentMemberFromMemberContext {
    currentMember {
      workspaceId
      id
      roles
      permissions
      status
      name
      email
    }
    currentAbilityRules {
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

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const { data } = useSuspenseQuery(GET_CURRENT_MEMBER_FROM_MEMBER_CONTEXT, {
    fetchPolicy: "network-only",
  });

  return (
    <CurrentMemberContext value={data.currentMember}>
      <AbilityProvider rules={data.currentAbilityRules}>
        {children}
      </AbilityProvider>
    </CurrentMemberContext>
  );
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
