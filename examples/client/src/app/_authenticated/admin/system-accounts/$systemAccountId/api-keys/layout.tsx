import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/$systemAccountId/api-keys",
)({
  component: Outlet,
  beforeLoad: ({ context, params }) => {
    if (!context.ability.can("read", "SystemAccountApiKey"))
      throw redirect({ to: "/admin/system-accounts/$systemAccountId", params });
    return { title: t("api-key:title") };
  },
});
