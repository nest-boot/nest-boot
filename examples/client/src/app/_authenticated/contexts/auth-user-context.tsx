import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentUserFromAuthenticatedRouteQuery } from "@/gql/graphql";

type AuthUser = NonNullable<
  GetCurrentUserFromAuthenticatedRouteQuery["currentUser"]
>;
const AuthUserContext = createContext<AuthUser | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function AuthUserProvider({
  value,
  children,
}: {
  value: AuthUser;
  children: ReactNode;
}) {
  return <AuthUserContext value={value}>{children}</AuthUserContext>;
}

export function useAuthUserContext() {
  const context = useContext(AuthUserContext);
  if (!context)
    throw new Error(
      "useAuthUserContext must be used within a AuthUserProvider",
    );
  return context;
}
