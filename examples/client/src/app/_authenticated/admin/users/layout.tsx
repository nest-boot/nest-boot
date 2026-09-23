import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: Outlet,
  beforeLoad: () => ({ title: t("admin:users.title") }),
});
