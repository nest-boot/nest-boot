import { createFileRoute, redirect } from "@tanstack/react-router";
import { graphql } from "@/gql";

const GET_FIRST_WORKSPACE_FROM_WORKSPACES_ROUTE = graphql(`
  query getFirstWorkspaceFromWorkspacesRoute {
    currentUser {
      workspaces(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authenticated/workspaces/")({
  beforeLoad: async ({ context: { apolloClient } }) => {
    const { data } = await apolloClient.query({
      query: GET_FIRST_WORKSPACE_FROM_WORKSPACES_ROUTE,
    });

    const workspace = data?.currentUser.workspaces?.edges?.[0]?.node;

    if (!workspace) {
      throw redirect({ to: "/user/workspaces" });
    }

    throw redirect({
      to: "/workspaces/$workspaceId",
      params: { workspaceId: workspace.id },
    });
  },
});
