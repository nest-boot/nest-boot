import { createContext, useContext } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceContextQuery } from "@/gql/graphql";
import { graphql } from "@/gql";

const GET_CURRENT_WORKSPACE_FROM_WORKSPACE_CONTEXT = graphql(`
  query getCurrentWorkspaceFromWorkspaceContext {
    currentWorkspace {
      id
      name
      features
      createdAt
      updatedAt
    }
  }
`);

const CurrentWorkspaceContext = createContext<
  GetCurrentWorkspaceFromWorkspaceContextQuery["currentWorkspace"] | null
>(null);

export function CurrentWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = useSuspenseQuery(
    GET_CURRENT_WORKSPACE_FROM_WORKSPACE_CONTEXT,
  );

  return (
    <CurrentWorkspaceContext value={data.currentWorkspace}>
      {children}
    </CurrentWorkspaceContext>
  );
}

export function useCurrentWorkspaceContext() {
  const context = useContext(CurrentWorkspaceContext);

  if (context == null) {
    throw new Error(
      "useCurrentWorkspaceContext must be used within a WorkspaceProvider",
    );
  }
  return context;
}
