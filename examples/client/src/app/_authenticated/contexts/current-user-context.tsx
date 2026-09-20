import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentUserFromAuthenticatedRouteQuery } from "@/gql/graphql";

type CurrentUser = NonNullable<
  GetCurrentUserFromAuthenticatedRouteQuery["currentUser"]
>;
const CurrentUserContext = createContext<CurrentUser | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function CurrentUserProvider({
  value,
  children,
}: {
  value: CurrentUser;
  children: ReactNode;
}) {
  return <CurrentUserContext value={value}>{children}</CurrentUserContext>;
}

export function useCurrentUserContext() {
  const context = useContext(CurrentUserContext);
  if (!context)
    throw new Error(
      "useCurrentUserContext must be used within a CurrentUserProvider",
    );
  return context;
}
