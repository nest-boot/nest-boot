import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { graphql } from "@/gql";

const GET_CURRENT_USER_FROM_AUTHENTICATED_ROUTE = graphql(`
  query getCurrentUserFromAuthenticatedRoute {
    currentUser {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated")({
  component: () => <Outlet />,
  beforeLoad: async ({ context: { apolloClient } }) => {
    try {
      const { data } = await apolloClient.query({
        query: GET_CURRENT_USER_FROM_AUTHENTICATED_ROUTE,
      });

      if (!data?.currentUser) {
        throw redirect({
          to: "/auth/login",
          search: { redirect: location.href },
        });
      }
    } catch (error) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
      });
    }
  },
});
