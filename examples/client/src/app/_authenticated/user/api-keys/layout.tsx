import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute("/_authenticated/user/api-keys")({
  component: Outlet,
  beforeLoad: ({ context }) => {
    if (!context.ability.can("read", "UserApiKey")) {
      throw redirect({ to: "/user" });
    }
    return { title: t("api-key:title") };
  },
});
