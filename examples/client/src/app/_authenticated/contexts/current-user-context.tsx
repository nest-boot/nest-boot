import { useSuspenseQuery } from "@apollo/client/react";
import { createContext, useContext, useMemo } from "react";

import type { ReactNode } from "react";
import type { GetCurrentUserFromCurrentUserContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";
import { createAbility } from "@/lib/ability";

const GET_CURRENT_USER_FROM_CURRENT_USER_CONTEXT = graphql(`
  query getCurrentUserFromCurrentUserContext {
    currentUser {
      id
      name
      email
      permissions
    }
    currentUserAbilityRules {
      actions
      subjects
      fields
      conditions
      inverted
      reason
    }
  }
`);

const CurrentUserContext = createContext<
  GetCurrentUserFromCurrentUserContextQuery["currentUser"] | null
>(null);
const CurrentUserAbilityContext = createContext<ReturnType<
  typeof createAbility
> | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data } = useSuspenseQuery(GET_CURRENT_USER_FROM_CURRENT_USER_CONTEXT);
  const ability = useMemo(
    () => createAbility(data.currentUserAbilityRules),
    [data.currentUserAbilityRules],
  );

  return (
    <CurrentUserContext value={data.currentUser}>
      <CurrentUserAbilityContext value={ability}>
        {children}
      </CurrentUserAbilityContext>
    </CurrentUserContext>
  );
}

export function useCurrentUserContext() {
  const context = useContext(CurrentUserContext);

  if (context == null) {
    throw new Error(
      "useCurrentUserContext must be used within a CurrentUserProvider",
    );
  }

  return context;
}

export function useCurrentUserAbility() {
  const ability = useContext(CurrentUserAbilityContext);

  if (ability == null) {
    throw new Error(
      "useCurrentUserAbility must be used within a CurrentUserProvider",
    );
  }

  return ability;
}
