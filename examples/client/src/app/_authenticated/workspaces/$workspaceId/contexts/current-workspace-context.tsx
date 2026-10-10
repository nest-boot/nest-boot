import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceLayoutQuery } from "@/gql/graphql";

type CurrentWorkspace = NonNullable<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery["workspace"]
>;
const CurrentWorkspaceContext = createContext<CurrentWorkspace | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function CurrentWorkspaceProvider({
  value,
  children,
}: {
  value: CurrentWorkspace;
  children: ReactNode;
}) {
  return (
    <CurrentWorkspaceContext value={value}>{children}</CurrentWorkspaceContext>
  );
}

export function useCurrentWorkspaceContext() {
  const context = useContext(CurrentWorkspaceContext);
  if (!context)
    throw new Error(
      "useCurrentWorkspaceContext must be used within a CurrentWorkspaceProvider",
    );
  return context;
}
