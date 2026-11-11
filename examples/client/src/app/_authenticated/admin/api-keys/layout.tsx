import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { SYSTEM_KEY_PERMISSIONS } from "@/graphql/system-accounts";
import { isAccessDenied } from "@/lib/auth-errors";

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  component: Outlet,
  beforeLoad: async ({ context }) => {
    if (!context.ability.can("read", "SystemAccountApiKey"))
      throw redirect({ to: "/admin" });
    const { data } = await context.apolloClient
      .query({ query: SYSTEM_KEY_PERMISSIONS, fetchPolicy: "network-only" })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw redirect({ to: "/user" });
        throw error;
      });
    return {
      keyPermissionOptions: data?.systemAccountApiKeyPermissions ?? [],
      title: t("api-key:title"),
    };
  },
});
