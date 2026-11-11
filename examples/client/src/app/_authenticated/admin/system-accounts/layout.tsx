import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { SYSTEM_ACCOUNT_PERMISSIONS } from "@/graphql/system-accounts";
import { isAccessDenied } from "@/lib/auth-errors";

export const Route = createFileRoute("/_authenticated/admin/system-accounts")({
  component: Outlet,
  beforeLoad: async ({ context }) => {
    if (!context.ability.can("read", "SystemAccount"))
      throw redirect({ to: "/admin" });
    const result = await context.apolloClient
      .query({ query: SYSTEM_ACCOUNT_PERMISSIONS, fetchPolicy: "network-only" })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw redirect({ to: "/user" });
        throw error;
      });
    return {
      accountPermissionOptions: result.data?.systemAccountPermissions ?? [],
      title: t("admin:system_accounts.title"),
    };
  },
});
