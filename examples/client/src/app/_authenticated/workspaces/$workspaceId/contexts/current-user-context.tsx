import { createContext, useContext } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentUserFromCurrentUserContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";

const GET_CURRENT_USER_FROM_CURRENT_USER_CONTEXT = graphql(`
  query getCurrentUserFromCurrentUserContext {
    currentUser {
      id
      name
      email
    }
  }
`);

const CurrentUserContext = createContext<
  GetCurrentUserFromCurrentUserContextQuery["currentUser"] | null
>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data } = useSuspenseQuery(GET_CURRENT_USER_FROM_CURRENT_USER_CONTEXT);

  return (
    <CurrentUserContext value={data.currentUser}>{children}</CurrentUserContext>
  );
}

export function useCurrentUserContext() {
  const context = useContext(CurrentUserContext);

  if (context == null) {
    throw new Error(
      "useCurrentUserContext must be used within a CurrentUserContext",
    );
  }
  return context;
}
