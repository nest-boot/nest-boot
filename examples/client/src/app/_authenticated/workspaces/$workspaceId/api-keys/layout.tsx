import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys",
)({
  component: Outlet,
  beforeLoad: ({ context, params }) => {
    if (!context.ability.can("read", "WorkspaceApiKey")) {
      throw redirect({
        to: "/workspaces/$workspaceId",
        params: { workspaceId: params.workspaceId },
      });
    }
    return { title: t("api-key:title") };
  },
});
