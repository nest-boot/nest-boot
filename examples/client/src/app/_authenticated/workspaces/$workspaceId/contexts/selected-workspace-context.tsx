import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceLayoutQuery } from "@/gql/graphql";

type SelectedWorkspace = NonNullable<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery["workspace"]
>;
const SelectedWorkspaceContext = createContext<SelectedWorkspace | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function SelectedWorkspaceProvider({
  value,
  children,
}: {
  value: SelectedWorkspace;
  children: ReactNode;
}) {
  return (
    <SelectedWorkspaceContext value={value}>
      {children}
    </SelectedWorkspaceContext>
  );
}

export function useSelectedWorkspaceContext() {
  const context = useContext(SelectedWorkspaceContext);
  if (!context)
    throw new Error(
      "useSelectedWorkspaceContext must be used within a SelectedWorkspaceProvider",
    );
  return context;
}
