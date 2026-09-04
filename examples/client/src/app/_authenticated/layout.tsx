import { useMutation, useQuery } from "@apollo/client/react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

import { CurrentUserProvider } from "./contexts/current-user-context";
import { Button } from "@/components/thread-ui/button";
import { graphql } from "@/gql";

const GET_CURRENT_USER_FROM_AUTHENTICATED_ROUTE = graphql(`
  query getCurrentUserFromAuthenticatedRoute {
    currentUser {
      id
    }
  }
`);

const GET_IMPERSONATION_FROM_AUTHENTICATED_ROUTE = graphql(`
  query getImpersonationFromAuthenticatedRoute {
    currentAuthSession {
      impersonatedById
    }
  }
`);

const STOP_IMPERSONATING_FROM_AUTHENTICATED_ROUTE = graphql(`
  mutation stopImpersonatingFromAuthenticatedRoute {
    stopImpersonating {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
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

function AuthenticatedLayout() {
  return (
    <CurrentUserProvider>
      <AuthenticatedContent />
    </CurrentUserProvider>
  );
}

function AuthenticatedContent() {
  const { data } = useQuery(GET_IMPERSONATION_FROM_AUTHENTICATED_ROUTE);
  const [stopImpersonating, { loading }] = useMutation(
    STOP_IMPERSONATING_FROM_AUTHENTICATED_ROUTE,
  );

  return (
    <>
      {data?.currentAuthSession?.impersonatedById ? (
        <div
          className="fixed inset-x-0 top-0 z-50 flex min-h-12 items-center justify-center gap-4 bg-amber-300 px-4 py-2 text-sm text-amber-950 shadow"
          data-testid="impersonation-banner"
        >
          <span>{t("admin:impersonation.active")}</span>
          <Button
            size="sm"
            variant="outline"
            loading={loading}
            data-testid="stop-impersonating"
            onClick={async () => {
              await stopImpersonating();
              window.location.assign("/admin/users");
            }}
          >
            {t("admin:impersonation.stop")}
          </Button>
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
