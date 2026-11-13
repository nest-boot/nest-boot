import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { SYSTEM_ACCOUNT_DETAILS } from "@/graphql/system-accounts";
import { isAccessDenied } from "@/lib/auth-errors";
import { createAbilitySubject } from "@/lib/ability";

export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/$systemAccountId",
)({
  component: Outlet,
  beforeLoad: async ({ context, params }) => {
    const denied = () => redirect({ to: "/admin/system-accounts" });
    const { data } = await context.apolloClient
      .query({
        query: SYSTEM_ACCOUNT_DETAILS,
        variables: {
          id: params.systemAccountId,
        },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const account = data?.systemAccount;
    if (
      !account ||
      !context.ability.can(
        "read",
        createAbilitySubject("SystemAccount", account),
      )
    )
      throw denied();
    return { account, title: account.name };
  },
});
