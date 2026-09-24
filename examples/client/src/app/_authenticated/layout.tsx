import { useMutation } from "@apollo/client/react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { CurrentUserProvider } from "./contexts/current-user-context";
import { Button } from "@/components/thread-ui/button";
import { graphql } from "@/gql";
import { createAbility } from "@/lib/ability";
import { AbilityProvider } from "@/contexts/ability-context";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_CURRENT_USER_FROM_AUTHENTICATED_ROUTE = graphql(`
  query getCurrentUserFromAuthenticatedRoute {
    currentUser {
      id
      name
      email
      permissions
    }
    currentSession {
      impersonatedById
    }
    currentAbilityRules {
      actions
      subjects
      fields
      conditions
      inverted
      reason
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
        fetchPolicy: "network-only",
      });

      if (!data?.currentUser) {
        throw redirect({
          to: "/auth/login",
          search: { redirect: location.href },
        });
      }
      return {
        currentUser: data.currentUser,
        currentSession: data.currentSession,
        ability: createAbility(data.currentAbilityRules),
      };
    } catch (error) {
      if (!isAccessDenied(error)) throw error;
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
      });
    }
  },
});

function AuthenticatedLayout() {
  const { currentUser, ability } = Route.useRouteContext();
  return (
    <CurrentUserProvider value={currentUser}>
      <AbilityProvider ability={ability}>
        <AuthenticatedContent />
      </AbilityProvider>
    </CurrentUserProvider>
  );
}

function AuthenticatedContent() {
  const { t } = useTranslation();
  const { currentSession } = Route.useRouteContext();
  const [stopImpersonating, { loading }] = useMutation(
    STOP_IMPERSONATING_FROM_AUTHENTICATED_ROUTE,
  );

  return (
    <div className="flex h-svh flex-col">
      {currentSession?.impersonatedById ? (
        <div className="bg-secondary text-secondary-foreground z-50 flex min-h-12 shrink-0 items-center justify-center gap-4 px-4 py-2 text-sm shadow">
          <span>{t("admin:impersonation.active")}</span>
          <Button
            size="sm"
            variant="outline"
            loading={loading}
            onClick={async () => {
              try {
                await stopImpersonating();
                window.location.assign("/admin/users");
              } catch {
                // A rejected restore may already have revoked the session.
                window.location.reload();
              }
            }}
          >
            {t("admin:impersonation.stop")}
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 [&>[data-slot=layout]]:h-full">
        <Outlet />
      </div>
    </div>
  );
}
