import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/member-groups",
)({
  component: () => <Outlet />,
  beforeLoad: () => {
    return {
      title: t("workspace-member-group:title"),
    };
  },
});
