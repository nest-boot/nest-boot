import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: Outlet,
  beforeLoad: ({ context }) => {
    if (!context.ability.can("read", "User")) throw redirect({ to: "/admin" });
    return { title: t("admin:users.title") };
  },
});
