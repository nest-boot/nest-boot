import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceLayoutQuery } from "@/gql/graphql";

type AuthWorkspaceMember = NonNullable<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery["currentWorkspaceMember"]
>;
const AuthWorkspaceMemberContext = createContext<AuthWorkspaceMember | null>(
  null,
);

/** Shares the identity already loaded and authorized by the route. */
export function AuthWorkspaceMemberProvider({
  value,
  children,
}: {
  value: AuthWorkspaceMember;
  children: ReactNode;
}) {
  return (
    <AuthWorkspaceMemberContext value={value}>
      {children}
    </AuthWorkspaceMemberContext>
  );
}

export function useAuthWorkspaceMemberContext() {
  const context = useContext(AuthWorkspaceMemberContext);
  if (!context)
    throw new Error(
      "useAuthWorkspaceMemberContext must be used within a AuthWorkspaceMemberProvider",
    );
  return context;
}
