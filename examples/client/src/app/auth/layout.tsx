import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { graphql } from "@/gql";

const GET_CURRENT_USER_FROM_AUTH_LAYOUT = graphql(`
  query getCurrentUserFromAuthLayout {
    currentUser {
      id
    }
  }
`);

export const Route = createFileRoute("/auth")({
  component: () => <Outlet />,
  beforeLoad: async ({ context: { apolloClient } }) => {
    const { data } = await apolloClient.query({
      query: GET_CURRENT_USER_FROM_AUTH_LAYOUT,
      fetchPolicy: "network-only",
      errorPolicy: "all",
    });

    if (data?.currentUser) {
      throw redirect({
        to: "/workspaces",
      });
    }
  },
});
