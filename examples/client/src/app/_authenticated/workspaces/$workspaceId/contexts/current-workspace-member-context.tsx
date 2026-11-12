import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceLayoutQuery } from "@/gql/graphql";

type CurrentWorkspaceMember = NonNullable<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery["currentWorkspaceMember"]
>;
const CurrentWorkspaceMemberContext =
  createContext<CurrentWorkspaceMember | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function CurrentWorkspaceMemberProvider({
  value,
  children,
}: {
  value: CurrentWorkspaceMember;
  children: ReactNode;
}) {
  return (
    <CurrentWorkspaceMemberContext value={value}>
      {children}
    </CurrentWorkspaceMemberContext>
  );
}

export function useCurrentWorkspaceMemberContext() {
  const context = useContext(CurrentWorkspaceMemberContext);
  if (!context)
    throw new Error(
      "useCurrentWorkspaceMemberContext must be used within a CurrentWorkspaceMemberProvider",
    );
  return context;
}
